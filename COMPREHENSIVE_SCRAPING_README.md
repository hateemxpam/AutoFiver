# Fiverr Gig Manager Pro - Comprehensive Scraping System

This Chrome extension now includes a comprehensive gig scraping system that collects detailed data from every tab of each gig page, including Overview, Pricing, Description & FAQ, Requirements, and Gallery.

## Features

### 🚀 Comprehensive Data Collection
- **Overview Tab**: Title, description, seller info, packages, delivery time, revisions, tags, images, video
- **Pricing Tab**: Detailed packages, extras, currency, pricing tiers
- **Description & FAQ Tab**: Full description, FAQ items, features, benefits, process steps
- **Requirements Tab**: Requirements list, what to provide, what you get, additional info
- **Gallery Tab**: Images, videos, portfolio items, categories

### 🔄 Centralized State Management
- Supabase configuration stored securely in Chrome storage
- Real-time connection status monitoring
- Automatic data synchronization between local storage and Supabase
- Cross-script communication for seamless data flow

### 📊 Visual Progress Tracking
- Real-time progress bar showing scraping status
- Detailed status messages for each gig being processed
- Error handling with fallback to local storage

### 🗄️ Supabase Integration
- Comprehensive database schema for all gig data
- Automatic upsert functionality to handle updates
- JSON storage for complex data structures
- Built-in statistics and analytics functions

## Setup Instructions

### 1. Database Setup
1. Create a new Supabase project
2. Run the `supabase_schema.sql` file in your Supabase SQL editor
3. This will create all necessary tables, functions, and policies

### 2. Extension Configuration
1. Open the extension popup
2. Enter your Supabase URL and API key in the configuration section
3. Click "Save" to test the connection
4. The extension will automatically sync data to Supabase when connected

### 3. Usage
1. Click "Scan & Load Gigs" to start the process
2. The extension will:
   - Navigate to your Fiverr seller dashboard
   - Extract basic gig information
   - Open each gig page in background tabs
   - Navigate through all tabs (Overview, Pricing, Description, Requirements, Gallery)
   - Collect comprehensive data from each tab
   - Store data locally and sync to Supabase
   - Show progress with visual indicators

## Data Structure

Each gig is stored with the following comprehensive structure:

```json
{
  "url": "gig_url",
  "title": "gig_title",
  "editUrl": "edit_url",
  "scraped_at": "timestamp",
  "overview": {
    "title": "gig_title",
    "description": "full_description",
    "seller_info": {
      "name": "seller_name",
      "rating": "seller_rating",
      "level": "seller_level"
    },
    "packages": [...],
    "delivery_time": "delivery_info",
    "revisions": "revision_info",
    "tags": [...],
    "images": [...],
    "video": "video_url"
  },
  "pricing": {
    "packages": [...],
    "extras": [...],
    "currency": "currency_code"
  },
  "description": {
    "description": "main_description",
    "faq": [...],
    "features": [...],
    "benefits": [...],
    "process": [...]
  },
  "requirements": {
    "requirements": [...],
    "what_to_provide": [...],
    "what_you_get": [...],
    "additional_info": "additional_text"
  },
  "gallery": {
    "images": [...],
    "videos": [...],
    "portfolio_items": [...],
    "categories": [...]
  },
  "metadata": {
    "user_agent": "browser_info",
    "timestamp": "scrape_timestamp",
    "page_title": "page_title"
  }
}
```

## Database Schema

The Supabase database includes:

- **gigs table**: Main table storing all gig data
- **gig_summary view**: Simplified view for quick queries
- **upsert_gig_from_json()**: Function for inserting/updating gig data
- **get_gig_stats()**: Function for retrieving statistics
- **test_connection()**: Function for testing database connectivity

## Error Handling

The system includes comprehensive error handling:

- **Connection Issues**: Falls back to local storage if Supabase is unavailable
- **Scraping Errors**: Continues with other gigs if one fails
- **Tab Navigation**: Handles cases where tabs might not be found
- **Data Validation**: Ensures data integrity before storage

## Performance Considerations

- **Polite Scraping**: Includes delays between requests to avoid overwhelming servers
- **Background Tabs**: Opens gigs in background tabs to avoid disrupting user workflow
- **Progress Tracking**: Shows real-time progress to keep users informed
- **Efficient Storage**: Uses JSONB for complex data structures in PostgreSQL

## Troubleshooting

### Common Issues

1. **Supabase Connection Failed**
   - Check your URL and API key
   - Ensure your Supabase project is active
   - Verify network connectivity

2. **Scraping Stops Midway**
   - Check browser console for errors
   - Ensure you're logged into Fiverr
   - Try refreshing and running again

3. **Missing Data**
   - Some gigs might have different page structures
   - Check the error field in stored data
   - The system will continue with available data

### Debug Information

The extension provides detailed console logging:
- `[Fiverr Reader]`: Main extension logs
- `[Gig Scraper]`: Detailed scraping logs
- Supabase connection status and errors

## Security

- All data is stored locally first, then synced to Supabase
- Supabase credentials are stored securely in Chrome storage
- Row Level Security (RLS) is enabled for data protection
- API keys are handled securely with proper authentication

## Future Enhancements

- Real-time data updates
- Advanced analytics dashboard
- Export functionality for different formats
- Integration with other platforms
- Automated scheduling for regular updates

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify Supabase connection status
3. Ensure all permissions are granted
4. Check the extension's storage for configuration issues

