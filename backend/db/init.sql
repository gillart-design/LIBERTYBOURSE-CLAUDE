-- TradeFlow init SQL (SQLAlchemy creates tables — this file adds extensions + indexes)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for ILIKE search optimization
