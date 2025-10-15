-- Supabase Database Schema for Fiverr Gig Manager Extension
-- This file contains the complete database schema for storing comprehensive gig data

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the main gigs table with comprehensive data structure
CREATE TABLE IF NOT EXISTS gigs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'extension_user',
    url TEXT NOT NULL,
    title TEXT,
    edit_url TEXT,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Overview data
    overview_title TEXT,
    overview_description TEXT,
    seller_name TEXT,
    seller_rating TEXT,
    seller_level TEXT,
    delivery_time TEXT,
    revisions TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    video_url TEXT,
    
    -- Pricing data
    packages JSONB DEFAULT '[]'::jsonb,
    extras JSONB DEFAULT '[]'::jsonb,
    currency TEXT,
    
    -- Description data
    description_content TEXT,
    faq JSONB DEFAULT '[]'::jsonb,
    features JSONB DEFAULT '[]'::jsonb,
    benefits JSONB DEFAULT '[]'::jsonb,
    process JSONB DEFAULT '[]'::jsonb,
    
    -- Requirements data
    requirements JSONB DEFAULT '[]'::jsonb,
    what_to_provide JSONB DEFAULT '[]'::jsonb,
    what_you_get JSONB DEFAULT '[]'::jsonb,
    additional_info TEXT,
    
    -- Gallery data
    gallery_images JSONB DEFAULT '[]'::jsonb,
    gallery_videos JSONB DEFAULT '[]'::jsonb,
    portfolio_items JSONB DEFAULT '[]'::jsonb,
    categories JSONB DEFAULT '[]'::jsonb,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    error TEXT,
    
    -- Indexes for better performance
    CONSTRAINT unique_user_gig UNIQUE (user_id, url)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_gigs_user_id ON gigs(user_id);
CREATE INDEX IF NOT EXISTS idx_gigs_scraped_at ON gigs(scraped_at);
CREATE INDEX IF NOT EXISTS idx_gigs_title ON gigs(title);
CREATE INDEX IF NOT EXISTS idx_gigs_seller_name ON gigs(seller_name);
CREATE INDEX IF NOT EXISTS idx_gigs_tags ON gigs USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_gigs_categories ON gigs USING GIN(categories);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_gigs_updated_at 
    BEFORE UPDATE ON gigs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create RPC function for upserting gig data
CREATE OR REPLACE FUNCTION upsert_gig_from_json(g JSONB)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Insert or update the gig
    INSERT INTO gigs (
        user_id, url, title, edit_url, scraped_at,
        overview_title, overview_description, seller_name, seller_rating, seller_level,
        delivery_time, revisions, tags, images, video_url,
        packages, extras, currency,
        description_content, faq, features, benefits, process,
        requirements, what_to_provide, what_you_get, additional_info,
        gallery_images, gallery_videos, portfolio_items, categories,
        metadata, error
    ) VALUES (
        COALESCE(g->>'user_id', 'extension_user'),
        g->>'url',
        g->>'title',
        g->>'edit_url',
        COALESCE((g->>'scraped_at')::timestamp with time zone, NOW()),
        g->>'overview_title',
        g->>'overview_description',
        g->>'seller_name',
        g->>'seller_rating',
        g->>'seller_level',
        g->>'delivery_time',
        g->>'revisions',
        COALESCE(g->'tags', '[]'::jsonb),
        COALESCE(g->'images', '[]'::jsonb),
        g->>'video_url',
        COALESCE(g->'packages', '[]'::jsonb),
        COALESCE(g->'extras', '[]'::jsonb),
        g->>'currency',
        g->>'description_content',
        COALESCE(g->'faq', '[]'::jsonb),
        COALESCE(g->'features', '[]'::jsonb),
        COALESCE(g->'benefits', '[]'::jsonb),
        COALESCE(g->'process', '[]'::jsonb),
        COALESCE(g->'requirements', '[]'::jsonb),
        COALESCE(g->'what_to_provide', '[]'::jsonb),
        COALESCE(g->'what_you_get', '[]'::jsonb),
        g->>'additional_info',
        COALESCE(g->'gallery_images', '[]'::jsonb),
        COALESCE(g->'gallery_videos', '[]'::jsonb),
        COALESCE(g->'portfolio_items', '[]'::jsonb),
        COALESCE(g->'categories', '[]'::jsonb),
        COALESCE(g->'metadata', '{}'::jsonb),
        g->>'error'
    )
    ON CONFLICT (user_id, url) 
    DO UPDATE SET
        title = EXCLUDED.title,
        edit_url = EXCLUDED.edit_url,
        scraped_at = EXCLUDED.scraped_at,
        overview_title = EXCLUDED.overview_title,
        overview_description = EXCLUDED.overview_description,
        seller_name = EXCLUDED.seller_name,
        seller_rating = EXCLUDED.seller_rating,
        seller_level = EXCLUDED.seller_level,
        delivery_time = EXCLUDED.delivery_time,
        revisions = EXCLUDED.revisions,
        tags = EXCLUDED.tags,
        images = EXCLUDED.images,
        video_url = EXCLUDED.video_url,
        packages = EXCLUDED.packages,
        extras = EXCLUDED.extras,
        currency = EXCLUDED.currency,
        description_content = EXCLUDED.description_content,
        faq = EXCLUDED.faq,
        features = EXCLUDED.features,
        benefits = EXCLUDED.benefits,
        process = EXCLUDED.process,
        requirements = EXCLUDED.requirements,
        what_to_provide = EXCLUDED.what_to_provide,
        what_you_get = EXCLUDED.what_you_get,
        additional_info = EXCLUDED.additional_info,
        gallery_images = EXCLUDED.gallery_images,
        gallery_videos = EXCLUDED.gallery_videos,
        portfolio_items = EXCLUDED.portfolio_items,
        categories = EXCLUDED.categories,
        metadata = EXCLUDED.metadata,
        error = EXCLUDED.error,
        updated_at = NOW()
    RETURNING to_jsonb(gigs.*);
    
    -- Return success result
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Gig upserted successfully'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- Create a view for easy querying of gig data
CREATE OR REPLACE VIEW gig_summary AS
SELECT 
    id,
    user_id,
    url,
    title,
    overview_title,
    seller_name,
    seller_rating,
    delivery_time,
    revisions,
    currency,
    scraped_at,
    created_at,
    updated_at,
    CASE 
        WHEN error IS NOT NULL THEN 'error'
        WHEN overview_title IS NOT NULL THEN 'complete'
        ELSE 'partial'
    END as status
FROM gigs
ORDER BY scraped_at DESC;

-- Create a function to get gig statistics
CREATE OR REPLACE FUNCTION get_gig_stats(user_id_param TEXT DEFAULT 'extension_user')
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_gigs', COUNT(*),
        'complete_gigs', COUNT(*) FILTER (WHERE overview_title IS NOT NULL AND error IS NULL),
        'error_gigs', COUNT(*) FILTER (WHERE error IS NOT NULL),
        'partial_gigs', COUNT(*) FILTER (WHERE overview_title IS NULL AND error IS NULL),
        'last_scraped', MAX(scraped_at),
        'unique_sellers', COUNT(DISTINCT seller_name) FILTER (WHERE seller_name IS NOT NULL),
        'total_packages', (
            SELECT COUNT(*)
            FROM gigs, jsonb_array_elements(packages) as package
            WHERE gigs.user_id = user_id_param
        )
    )
    INTO result
    FROM gigs
    WHERE user_id = user_id_param;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS) for better security
ALTER TABLE gigs ENABLE ROW LEVEL SECURITY;

-- Create policy for user data access
CREATE POLICY "Users can access their own gigs" ON gigs
    FOR ALL USING (user_id = 'extension_user');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON gigs TO anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_gig_from_json(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_gig_stats(TEXT) TO anon, authenticated;
GRANT SELECT ON gig_summary TO anon, authenticated;

-- Create a sample query function for testing
CREATE OR REPLACE FUNCTION test_connection()
RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_build_object(
        'status', 'connected',
        'timestamp', NOW(),
        'message', 'Supabase connection successful'
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION test_connection() TO anon, authenticated;

-- Insert sample data for testing (optional)
-- INSERT INTO gigs (user_id, url, title, overview_title, seller_name) 
-- VALUES ('extension_user', 'https://example.com/gig1', 'Sample Gig', 'Sample Title', 'Sample Seller');

COMMENT ON TABLE gigs IS 'Comprehensive gig data storage for Fiverr Gig Manager Extension';
COMMENT ON FUNCTION upsert_gig_from_json(JSONB) IS 'Upserts gig data from JSON payload';
COMMENT ON FUNCTION get_gig_stats(TEXT) IS 'Returns statistics for a user''s gigs';
COMMENT ON VIEW gig_summary IS 'Simplified view of gig data for quick queries';