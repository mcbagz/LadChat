"""
Update ChromaDB with existing embeddings from the database
"""

import logging
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from database import SessionLocal
from models import User
from models.embeddings import UserEmbedding
from ai.chroma_client import chroma_client

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def update_chromadb_users():
    """Update ChromaDB with existing user embeddings"""
    logger.info("Updating ChromaDB with existing user embeddings...")
    
    db = SessionLocal()
    try:
        # Get all user embeddings
        user_embeddings = db.query(UserEmbedding).all()
        logger.info(f"Found {len(user_embeddings)} user embeddings in database")
        
        updated_count = 0
        for user_embedding in user_embeddings:
            try:
                # Get user details
                user = db.query(User).filter(User.id == user_embedding.user_id).first()
                if not user or not user.is_active:
                    continue
                
                logger.info(f"Updating ChromaDB for user {user.id} ({user.username})")
                
                # Add to ChromaDB with fixed metadata
                success = chroma_client.add_user_embedding(
                    user.id,
                    user_embedding.profile_embedding,
                    [],  # Empty message embedding for testing
                    metadata={
                        "username": user.username
                    }
                )
                
                if success:
                    updated_count += 1
                    logger.info(f"✅ Updated ChromaDB for user {user.id}")
                else:
                    logger.warning(f"❌ Failed to update ChromaDB for user {user.id}")
                    
            except Exception as e:
                logger.error(f"❌ Error updating ChromaDB for user {user_embedding.user_id}: {e}")
                continue
        
        logger.info(f"✅ ChromaDB update completed. Updated {updated_count} users.")
        
        # Get final stats
        chroma_stats = chroma_client.get_collection_stats()
        logger.info(f"📊 Final ChromaDB stats - Users: {chroma_stats['users']}, Events: {chroma_stats['events']}")
        
    except Exception as e:
        logger.error(f"❌ Failed to update ChromaDB: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    update_chromadb_users() 