# PC Screentime App Configuration

## Your Supabase URLs

### Base URL:
```
https://wxqmrercyutrrlnhlmus.supabase.co
```

### Edge Function URL (for uploading screentime data):
```
https://wxqmrercyutrrlnhlmus.supabase.co/functions/v1/upload-screentime
```

### Anon Key (for authentication):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4cW1yZXJjeXV0cnJsbmhsbXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTU5NzIsImV4cCI6MjA4NTczMTk3Mn0.CWu0bOSorBwsacAd6XFwRYnyXh5dLndBJ3bOPdOOx2s
```

## C# App Configuration

In your C# screentime tracker app, use these values:

```csharp
public class ScreentimeUploader
{
    // Your Supabase project URL
    private readonly string _supabaseUrl = "https://wxqmrercyutrrlnhlmus.supabase.co";
    
    // Your Supabase anon key (for API authentication)
    private readonly string _supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4cW1yZXJjeXV0cnJsbmhsbXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTU5NzIsImV4cCI6MjA4NTczMTk3Mn0.CWu0bOSorBwsacAd6XFwRYnyXh5dLndBJ3bOPdOOx2s";
    
    // Edge Function endpoint
    private readonly string _functionUrl;
    
    public ScreentimeUploader()
    {
        _functionUrl = $"{_supabaseUrl}/functions/v1/upload-screentime";
    }
    
    public async Task<bool> UploadScreentimeData(string userId, string deviceId, object screentimeJsonData)
    {
        using var httpClient = new HttpClient();
        
        // Set required headers
        httpClient.DefaultRequestHeaders.Add("apikey", _supabaseAnonKey);
        httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {_supabaseAnonKey}");
        httpClient.DefaultRequestHeaders.Add("Content-Type", "application/json");
        
        // Prepare payload
        var payload = new
        {
            user_id = userId,
            device_id = deviceId,
            platform = "windows",
            source = "pc",
            data = screentimeJsonData
        };
        
        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        
        try
        {
            var response = await httpClient.PostAsync(_functionUrl, content);
            var result = await response.Content.ReadAsStringAsync();
            
            if (response.IsSuccessStatusCode)
            {
                Console.WriteLine($"Upload successful: {result}");
                return true;
            }
            else
            {
                Console.WriteLine($"Upload failed ({response.StatusCode}): {result}");
                return false;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error uploading: {ex.Message}");
            return false;
        }
    }
}
```

## Important Notes:

1. **User ID**: You need to get your LifeOS user ID. You can find it in:
   - LifeOS web app → Settings → Account → Copy User ID
   - Or query `auth.users` table in Supabase Dashboard

2. **Device ID**: Use your PC name or a unique identifier:
   ```csharp
   string deviceId = Environment.MachineName; // e.g., "DESKTOP-ABC123"
   ```

3. **Testing**: Test the function first with a small JSON payload to make sure it works

4. **Error Handling**: The function returns JSON with `success`, `inserted`, and `errors` fields - check these in your app

## Example Usage:

```csharp
var uploader = new ScreentimeUploader();
string userId = "your-user-uuid-here"; // Get from LifeOS Settings
string deviceId = Environment.MachineName;

// Load your JSON file
string jsonPath = @"path\to\screentime.json";
string jsonContent = File.ReadAllText(jsonPath);
var jsonData = JsonSerializer.Deserialize<object>(jsonContent);

bool success = await uploader.UploadScreentimeData(userId, deviceId, jsonData);
```
