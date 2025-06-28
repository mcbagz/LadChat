"""
ChromaDB client for storing and querying embeddings
Handles all vector database operations for the RAG system
"""

import chromadb
from chromadb.config import Settings
import logging
from typing import List, Dict, Optional, Any
import os
from pathlib import Path

logger = logging.getLogger(__name__)

class ChromaClient:
    """ChromaDB client for embedding storage and similarity search"""
    
    def __init__(self):
        """Initialize ChromaDB with persistent storage"""
        # Create chroma data directory if it doesn't exist
        chroma_path = Path("./chroma_data")
        chroma_path.mkdir(exist_ok=True)
        
        # Initialize ChromaDB with persistent storage
        self.client = chromadb.PersistentClient(
            path=str(chroma_path),
            settings=Settings(
                anonymized_telemetry=False,  # Disable telemetry for privacy
                allow_reset=True
            )
        )
        
        # Initialize collections
        self._initialize_collections()
        
        logger.info("ChromaDB client initialized")
    
    def _initialize_collections(self):
        """Initialize all required collections"""
        try:
            # Users collection for friend recommendations
            self.users_collection = self.client.get_or_create_collection(name="users")
            
            # Events collection for event recommendations
            self.events_collection = self.client.get_or_create_collection(name="events")
            
            # Groups collection for group analysis
            self.groups_collection = self.client.get_or_create_collection(name="groups")
            
            logger.info("All ChromaDB collections initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB collections: {e}")
            raise
    
    def add_user_embedding(self, user_id: int, profile_embedding: List[float], 
                          message_embedding: List[float], metadata: Dict[str, Any] = None) -> bool:
        """Add or update user embeddings (simplified for testing - uses only profile embedding)"""
        try:
            # For testing: use only profile embedding (ignore message_embedding)
            # This simplifies the system and removes dependency on message history
            embedding_to_use = profile_embedding
            
            # Prepare minimal metadata - interests should be in the embedding, not metadata
            user_metadata = {
                "user_id": user_id,
                "type": "user",
                "username": metadata.get("username", "") if metadata else ""
            }
            
            # Add to collection
            self.users_collection.upsert(
                ids=[f"user_{user_id}"],
                embeddings=[embedding_to_use],
                metadatas=[user_metadata]
            )
            
            logger.debug(f"Added user embedding for user {user_id} (profile-only for testing)")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add user embedding for user {user_id}: {e}")
            return False
    
    def add_event_embedding(self, event_id: int, event_embedding: List[float], 
                           metadata: Dict[str, Any] = None) -> bool:
        """Add event embedding"""
        try:
            # Prepare metadata
            event_metadata = {
                "event_id": event_id,
                "type": "event",
                **(metadata or {})
            }
            
            # Add to collection
            self.events_collection.upsert(
                ids=[f"event_{event_id}"],
                embeddings=[event_embedding],
                metadatas=[event_metadata]
            )
            
            logger.debug(f"Added event embedding for event {event_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add event embedding for event {event_id}: {e}")
            return False
    
    def add_group_embedding(self, group_id: int, group_embedding: List[float], 
                           metadata: Dict[str, Any] = None) -> bool:
        """Add or update group embedding"""
        try:
            # Prepare metadata
            group_metadata = {
                "group_id": group_id,
                "type": "group",
                **(metadata or {})
            }
            
            # Add to collection
            self.groups_collection.upsert(
                ids=[f"group_{group_id}"],
                embeddings=[group_embedding],
                metadatas=[group_metadata]
            )
            
            logger.debug(f"Added group embedding for group {group_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add group embedding for group {group_id}: {e}")
            return False
    
    def query_similar_users(self, query_embedding: List[float], n_results: int = 10, 
                           exclude_user_ids: List[int] = None) -> List[Dict[str, Any]]:
        """Query for similar users"""
        try:
            # Prepare where filter to exclude specific users
            where_filter = {}
            if exclude_user_ids:
                where_filter = {"user_id": {"$nin": exclude_user_ids}}
            
            # Query collection
            results = self.users_collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=where_filter if where_filter else None
            )
            
            # Format results
            formatted_results = []
            if results['ids'] and results['ids'][0]:
                for i in range(len(results['ids'][0])):
                    formatted_results.append({
                        "id": results['ids'][0][i],
                        "user_id": results['metadatas'][0][i]['user_id'],
                        "distance": results['distances'][0][i] if results.get('distances') else None,
                        "metadata": results['metadatas'][0][i]
                    })
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"Failed to query similar users: {e}")
            return []
    
    def query_similar_events(self, query_embedding: List[float], n_results: int = 10,
                            event_ids: List[int] = None) -> List[Dict[str, Any]]:
        """Query for similar events, optionally filtered by event IDs"""
        try:
            # Prepare where filter
            where_filter = {}
            if event_ids:
                where_filter = {"event_id": {"$in": event_ids}}
            
            # Query collection
            results = self.events_collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=where_filter if where_filter else None
            )
            
            # Format results
            formatted_results = []
            if results['ids'] and results['ids'][0]:
                for i in range(len(results['ids'][0])):
                    formatted_results.append({
                        "id": results['ids'][0][i],
                        "event_id": results['metadatas'][0][i]['event_id'],
                        "distance": results['distances'][0][i] if results.get('distances') else None,
                        "metadata": results['metadatas'][0][i]
                    })
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"Failed to query similar events: {e}")
            return []
    
    def get_group_embedding(self, group_id: int) -> Optional[List[float]]:
        """Get group embedding by ID"""
        try:
            results = self.groups_collection.get(
                ids=[f"group_{group_id}"],
                include=["embeddings"]
            )
            
            if results['embeddings'] and results['embeddings'][0]:
                return results['embeddings'][0]
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get group embedding for group {group_id}: {e}")
            return None
    
    def delete_user_embedding(self, user_id: int) -> bool:
        """Delete user embedding"""
        try:
            self.users_collection.delete(ids=[f"user_{user_id}"])
            logger.debug(f"Deleted user embedding for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete user embedding for user {user_id}: {e}")
            return False
    
    def delete_event_embedding(self, event_id: int) -> bool:
        """Delete event embedding"""
        try:
            self.events_collection.delete(ids=[f"event_{event_id}"])
            logger.debug(f"Deleted event embedding for event {event_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete event embedding for event {event_id}: {e}")
            return False
    
    def delete_group_embedding(self, group_id: int) -> bool:
        """Delete group embedding"""
        try:
            self.groups_collection.delete(ids=[f"group_{group_id}"])
            logger.debug(f"Deleted group embedding for group {group_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete group embedding for group {group_id}: {e}")
            return False
    
    def get_collection_stats(self) -> Dict[str, int]:
        """Get statistics about all collections"""
        try:
            return {
                "users": self.users_collection.count(),
                "events": self.events_collection.count(),
                "groups": self.groups_collection.count()
            }
        except Exception as e:
            logger.error(f"Failed to get collection stats: {e}")
            return {"users": 0, "events": 0, "groups": 0}
    
    def reset_all_collections(self) -> bool:
        """Reset all collections (for development/testing)"""
        try:
            self.client.reset()
            self._initialize_collections()
            logger.warning("All ChromaDB collections have been reset")
            return True
            
        except Exception as e:
            logger.error(f"Failed to reset collections: {e}")
            return False

# Global instance
chroma_client = ChromaClient() 