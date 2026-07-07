from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

# SQLite file lives in project root as healthcare.db
DATABASE_URL = "sqlite:///./healthcare.db"

engine = create_engine(
    DATABASE_URL,
    # 🟢 Added timeout=30 to handle concurrent writes without locking errors
    connect_args={"check_same_thread": False, "timeout": 30}  
)

# WAL mode: reads won't block while a write is in progress
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()