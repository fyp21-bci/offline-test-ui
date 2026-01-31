# High-Resolution Plot Feature - Updated

## Overview
High-resolution matplotlib plots from the backend are now displayed alongside the existing Plotly charts. The feature automatically updates when users:
- Select/deselect channels
- Adjust the time window via Plotly interactions (zoom, pan, rangeslider)
- Use the Quick Zoom preset buttons

## User Workflow

### Initial State
- When a dataset is loaded, the high-resolution plot shows the **full time range**
- All visible channels are included in the plot

### Interactive Updates
- When the user **drags the Plotly rangeslider**, **zooms**, or **pans** the chart:
  1. The Plotly chart updates in real-time
  2. When the mouse is released (on `relayout` event), the time window is captured
  3. A new high-resolution plot is fetched from the backend with the selected time range
  4. The image updates to show only the selected time window

### Channel Selection
- Toggling channels on/off in the Channel Controls triggers a new plot fetch
- Only visible channels are included in the high-resolution plot

## Technical Implementation

### Communication Flow
```
User Interaction (Plotly Chart)
    ↓
TimeSeriesChart.handleRelayout()
    ↓
onRangeChange callback
    ↓
App.handleRangeChange()
    ↓
App state updates (xAxisRange)
    ↓
DetailView receives new timeWindow prop
    ↓
useEffect triggers new API call
    ↓
Backend /datasets/plot endpoint
    ↓
PNG image displayed
```

### Key Changes

#### 1. TimeSeriesChart Component
- **New Prop:** `onRangeChange?: (range: [number, number] | null) => void`
- **Behavior:** Calls `onRangeChange` whenever the user changes the visible time range
- **Trigger Events:**
  - Rangeslider drag (on mouse release)
  - Zoom box selection
  - Pan/drag
  - Autoscale reset

#### 2. App Component
- **New Handler:** `handleRangeChange(range)` - updates `xAxisRange` state
- **Initialization:** Sets `xAxisRange` to `null` (full range) when dataset loads
- **Props Passed to TimeSeriesChart:** Added `onRangeChange={handleRangeChange}`
- **Props Passed to DetailView:** Added `dataLength={rawSignalData.length}`

#### 3. DetailView Component
- **New Prop:** `dataLength: number` - total number of samples in dataset
- **Updated Logic:**
  - When `timeWindow` is `null`: Uses full range `[0, dataLength/samplingRate]`
  - When `timeWindow` is provided: Uses the specific time window
  - Fetches plot whenever `datasetId`, `selectedChannels`, `timeWindow`, `dataLength`, or `samplingRate` changes

### Code Example

**TimeSeriesChart propagating range changes:**
```typescript
const handleRelayout = (e: any) => {
    if (e['xaxis.range[0]'] !== undefined && e['xaxis.range[1]'] !== undefined) {
        const newRange: [number, number] = [
            Math.floor(e['xaxis.range[0]']),
            Math.ceil(e['xaxis.range[1]'])
        ];
        setCurrentXRange(newRange);
        
        // Notify parent component
        if (onRangeChange) {
            onRangeChange(newRange);
        }
    }
};
```

**DetailView calculating time window:**
```typescript
// Calculate time window: use provided window or full range
const startTime = timeWindow ? timeWindow.start : 0;
const endTime = timeWindow ? timeWindow.end : (dataLength / samplingRate);

const imageUrl = await ApiService.getPlotImage(
    datasetId,
    selectedChannels,
    startTime,
    endTime
);
```

## Behavior Summary

| User Action | Result |
|-------------|--------|
| Load dataset | Shows full time range plot |
| Drag rangeslider | Updates plot to selected window when mouse released |
| Zoom in/out | Updates plot to new visible range |
| Pan left/right | Updates plot to new visible range |
| Click Quick Zoom button | Updates plot to preset time window (1s, 5s, etc.) |
| Click "Full" button | Resets plot to full time range |
| Toggle channel visibility | Updates plot with new channel selection |
| Reset zoom (double-click) | Resets plot to full time range |

## Performance Considerations

- **Debouncing:** The plot only fetches when the `relayout` event fires (mouse release), not during dragging
- **Memory Management:** Old blob URLs are revoked when new images are fetched
- **Loading States:** Shows spinner while fetching, preventing user confusion
- **Error Handling:** Displays user-friendly error messages if the backend request fails

## Future Enhancements

1. **Debounce/Throttle:** Add a small delay before fetching to handle rapid changes
2. **Caching:** Cache plots by time window and channels to avoid redundant requests
3. **Download Button:** Allow users to save the high-resolution image
4. **DPI Controls:** Let users select plot resolution (e.g., 150, 300, 600 DPI)
5. **Format Options:** Support SVG, PDF exports
6. **Batch Export:** Generate plots for all analysis windows at once
