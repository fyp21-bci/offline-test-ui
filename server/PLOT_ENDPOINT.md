# Plot Generation Endpoint

## Endpoint: `/datasets/plot`

### Method
`POST`

### Description
Generates a matplotlib plot for specified channels and time window from a dataset. Returns a PNG image without titles.

### Request Body
```json
{
  "dataset_id": "string",      // ID of the dataset (filename)
  "channels": [0, 1, 2],       // List of channel indices to plot
  "time_start": 0.0,           // Start time in seconds
  "time_end": 5.0,             // End time in seconds
  "plot_type": "time"          // Optional: "time" (default) or "fft"
}
```

#### Plot Types
- **`"time"`** (default): Raw time-domain signal plot
  - X-axis: Time (seconds)
  - Y-axis: Signal amplitude (µV)
  
- **`"fft"`**: Frequency-domain (FFT) plot
  - X-axis: Frequency (Hz)
  - Y-axis: Magnitude

### Response
- **Content-Type**: `image/png`
- Returns a PNG image file

### Features
- ✓ High-DPI output (150 DPI)
- ✓ No titles on the plot (clean visualization)
- ✓ Automatic subplot layout for multiple channels
- ✓ Grid lines for better readability
- ✓ Y-axis labels show channel names
- ✓ X-axis shows time in seconds

### Error Responses

#### 404 Not Found
```json
{
  "detail": "Dataset not found"
}
```

#### 400 Bad Request
```json
{
  "detail": "Channel index X out of range (0-Y)"
}
```
or
```json
{
  "detail": "Time window out of range. Valid range: 0 to Xs"
}
```
or
```json
{
  "detail": "time_start must be less than time_end"
}
```

### Examples

#### cURL Example - Time-Domain Plot
```bash
curl -X POST "http://localhost:8000/datasets/plot" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_id": "my_eeg_data.txt",
    "channels": [0, 1, 2],
    "time_start": 0.0,
    "time_end": 10.0,
    "plot_type": "time"
  }' \
  --output time_plot.png
```

#### cURL Example - FFT Plot
```bash
curl -X POST "http://localhost:8000/datasets/plot" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_id": "my_eeg_data.txt",
    "channels": [0, 1, 2],
    "time_start": 0.0,
    "time_end": 10.0,
    "plot_type": "fft"
  }' \
  --output fft_plot.png
```

#### Python Example with requests - Both Plot Types
```python
import requests

# Generate time-domain plot
response = requests.post(
    "http://localhost:8000/datasets/plot",
    json={
        "dataset_id": "my_eeg_data.txt",
        "channels": [0, 1, 2, 3],
        "time_start": 0.0,
        "time_end": 5.0,
        "plot_type": "time"
    }
)

if response.status_code == 200:
    with open("time_plot.png", "wb") as f:
        f.write(response.content)
    print("Time-domain plot saved")

# Generate FFT plot
response = requests.post(
    "http://localhost:8000/datasets/plot",
    json={
        "dataset_id": "my_eeg_data.txt",
        "channels": [0, 1, 2, 3],
        "time_start": 0.0,
        "time_end": 5.0,
        "plot_type": "fft"
    }
)

if response.status_code == 200:
    with open("fft_plot.png", "wb") as f:
        f.write(response.content)
    print("FFT plot saved")
```

#### Python Example with httpx
```python
import httpx

# Time-domain plot
response = httpx.post(
    "http://localhost:8000/datasets/plot",
    json={
        "dataset_id": "my_eeg_data.txt",
        "channels": [0, 1],
        "time_start": 2.0,
        "time_end": 7.0,
        "plot_type": "time"
    }
)

if response.status_code == 200:
    with open("time_plot.png", "wb") as f:
        f.write(response.content)

# FFT plot
response = httpx.post(
    "http://localhost:8000/datasets/plot",
    json={
        "dataset_id": "my_eeg_data.txt",
        "channels": [0, 1],
        "time_start": 2.0,
        "time_end": 7.0,
        "plot_type": "fft"
    }
)

if response.status_code == 200:
    with open("fft_plot.png", "wb") as f:
        f.write(response.content)
```

#### JavaScript/TypeScript Example
```typescript
// Function to generate both plot types
async function generatePlots(datasetId: string, channels: number[], timeStart: number, timeEnd: number) {
  const baseRequest = {
    dataset_id: datasetId,
    channels: channels,
    time_start: timeStart,
    time_end: timeEnd
  };
  
  // Generate time-domain plot
  const timeResponse = await fetch('http://localhost:8000/datasets/plot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...baseRequest, plot_type: 'time' })
  });
  
  if (timeResponse.ok) {
    const blob = await timeResponse.blob();
    const url = URL.createObjectURL(blob);
    
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Time-domain plot';
    document.getElementById('time-plot-container')?.appendChild(img);
  }
  
  // Generate FFT plot
  const fftResponse = await fetch('http://localhost:8000/datasets/plot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...baseRequest, plot_type: 'fft' })
  });
  
  if (fftResponse.ok) {
    const blob = await fftResponse.blob();
    const url = URL.createObjectURL(blob);
    
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'FFT plot';
    document.getElementById('fft-plot-container')?.appendChild(img);
  }
}

// Usage
generatePlots('my_eeg_data.txt', [0, 1, 2], 0.0, 10.0);
```

### Testing

Run the provided test script:
```bash
uv run python test_plot_endpoint.py
```

Or test interactively with the FastAPI docs at:
```
http://localhost:8000/docs
```

### Notes

1. **Channel Indices**: Zero-based indexing. If your dataset has 8 channels, valid indices are 0-7.

2. **Time Window**: 
   - Specified in seconds
   - Must be within the dataset's duration
   - Automatically converted to sample indices based on the dataset's sampling frequency

3. **Plot Types**:
   - **Time-domain (`"time"`)**: Shows raw signal amplitude over time
     - Useful for detecting artifacts, signal quality, temporal patterns
   - **FFT (`"fft"`)**: Shows frequency spectrum
     - Useful for identifying dominant frequencies, power distribution
     - Uses `np.fft.rfft` for efficient computation on real signals
     - Magnitude spectrum (absolute values of FFT coefficients)
     - **Range Limited**: X-axis is automatically limited to 0-60Hz to focus on physiological EEG data ranges

4. **Backward Compatibility**: 
   - The `plot_type` parameter defaults to `"time"`
   - Existing API calls without `plot_type` will continue to work

5. **Image Quality**: 
   - Default DPI is 150 (good balance between quality and file size)
   - Can be modified in the code if needed

6. **Memory**: The endpoint creates plots in memory and cleans up automatically. No temporary files are created on disk.

7. **FFT Considerations**:
   - Longer time windows provide better frequency resolution
   - Very short windows may not capture low-frequency components
   - The Nyquist frequency (fs/2) is the maximum frequency shown
   - For noisy data, consider using the separate FFT Analysis processor with Welch's method for smoothing

8. **Extensibility**: The `plot_type` parameter makes it easy to add new plot types in the future (e.g., spectrograms, wavelets) without breaking existing functionality.
