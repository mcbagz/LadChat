#!/usr/bin/env python3
"""
Test script for the RAG system implementation
Run this to verify that all components are working correctly
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the server directory to the Python path
sys.path.append(str(Path(__file__).parent))

async def test_rag_system():
    """Test the RAG system components"""
    print("🚀 Testing LadChat RAG System...")
    
    # Test 1: ChromaDB Client
    print("\n1. Testing ChromaDB Client...")
    try:
        from ai.chroma_client import chroma_client
        
        # Test collection initialization
        stats = chroma_client.get_collection_stats()
        print(f"   ✅ ChromaDB initialized: {stats}")
        
    except Exception as e:
        print(f"   ❌ ChromaDB test failed: {e}")
        return False
    
    # Test 2: Embedding Service (without OpenAI for now)
    print("\n2. Testing Embedding Service...")
    try:
        from ai.embedding_service import embedding_service
        
        if embedding_service.client is None:
            print("   ⚠️  OpenAI client not initialized (OPENAI_API_KEY not set)")
            print("   ℹ️  This is expected in development - add your API key to test embeddings")
        else:
            print("   ✅ OpenAI client initialized")
            
    except Exception as e:
        print(f"   ❌ Embedding service test failed: {e}")
        return False
    
    # Test 3: RAG Engine
    print("\n3. Testing RAG Engine...")
    try:
        from ai.rag_engine import rag_engine
        print("   ✅ RAG engine initialized successfully")
        
    except Exception as e:
        print(f"   ❌ RAG engine test failed: {e}")
        return False
    
    # Test 4: Database Models
    print("\n4. Testing Database Models...")
    try:
        from models.embeddings import UserEmbedding, GroupEmbedding, EventEmbedding, ChatActivity
        print("   ✅ Embedding models imported successfully")
        
    except Exception as e:
        print(f"   ❌ Database models test failed: {e}")
        return False
    
    # Test 5: API Routes
    print("\n5. Testing API Routes...")
    try:
        from routes.recommendations import router as rec_router
        from routes.notifications import router as notif_router
        from routes.venues import router as venue_router
        
        print("   ✅ All routes imported successfully")
        
    except Exception as e:
        print(f"   ❌ API routes test failed: {e}")
        return False
    
    # Test 6: Database Connection
    print("\n6. Testing Database Connection...")
    try:
        from database import SessionLocal, engine
        from sqlalchemy import text
        
        # Test basic connection
        with SessionLocal() as db:
            result = db.execute(text("SELECT 1")).fetchone()
            if result and result[0] == 1:
                print("   ✅ Database connection successful")
            else:
                print("   ❌ Database connection failed")
                return False
                
    except Exception as e:
        print(f"   ❌ Database connection test failed: {e}")
        return False
    
    # Test 7: Background Tasks
    print("\n7. Testing Background Tasks...")
    try:
        from ai.embedding_tasks import update_user_embeddings
        print("   ✅ Background tasks imported successfully")
        
    except Exception as e:
        print(f"   ❌ Background tasks test failed: {e}")
        return False
    
    print("\n🎉 All tests passed! The RAG system is ready to use.")
    print("\n📝 Next steps:")
    print("   1. Set your OPENAI_API_KEY environment variable")
    print("   2. Run the server: python main.py")
    print("   3. Test the API endpoints:")
    print("      - GET /recommendations/friends")
    print("      - GET /recommendations/events?latitude=40.7128&longitude=-74.0060")
    print("      - GET /notifications/chat-summary")
    print("      - GET /venues")
    
    return True

def test_environment():
    """Test environment setup"""
    print("🔧 Environment Check...")
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("   ❌ Python 3.8+ required")
        return False
    else:
        print(f"   ✅ Python {sys.version_info.major}.{sys.version_info.minor}")
    
    # Check OpenAI API key
    if os.getenv('OPENAI_API_KEY'):
        print("   ✅ OPENAI_API_KEY found")
    else:
        print("   ⚠️  OPENAI_API_KEY not set (embeddings will not work)")
    
    # Check required directories
    required_dirs = ['chroma_data', 'media', 'logs']
    for dir_name in required_dirs:
        dir_path = Path(dir_name)
        if not dir_path.exists():
            dir_path.mkdir(exist_ok=True)
            print(f"   ✅ Created {dir_name} directory")
        else:
            print(f"   ✅ {dir_name} directory exists")
    
    return True

if __name__ == "__main__":
    print("🧪 LadChat RAG System Test Suite\n")
    
    # Test environment first
    if not test_environment():
        print("❌ Environment check failed")
        sys.exit(1)
    
    # Run async tests
    success = asyncio.run(test_rag_system())
    
    if success:
        print("\n✅ All systems go! 🚀")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Please check the errors above.")
        sys.exit(1) 