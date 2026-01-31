# Signal Processing Server API Specification

This document outlines the capabilities and API endpoints of the Signal Processing Server. It is intended to guide the development of the frontend user interface.

## System Capabilities

The server provides a modular backend for analyzing biosignal data. Its core capabilities include:

1.  **Dataset Management**: Users can upload biosignal files (currently OpenBCI text format) and list available datasets.
2.  **Algorithm Discovery**: The server dynamically lists available signal processing modules (Processors). New algorithms can be added to the backend without changing the UI code.
3.  **Dynamic Configuration**: Each algorithm defines its own configuration parameters. The API provides these definitions so the UI can automatically generate the appropriate settings forms (e.g., input fields, sliders).
4.  **Analysis Execution**: Users can run a selected algorithm on a specific dataset with custom parameters.
5.  **Result Standardization**: Analysis results are returned in standardized formats (e.g., Classification, Spectrum) to simplify visualization implementation.

## API Design Overview

-   **Protocol**: HTTP/1.1 (REST)
-   **Data Format**: JSON for all metadata and analysis results. File uploads use `multipart/form-data`.
-   **Philosophy**: The API is "Schema-Driven". The UI should not hardcode form fields for algorithms. Instead, it should request the configuration schema from the server and render the form dynamically.

## Endpoint Descriptions

### 1. Dataset Management

#### Upload Dataset
*   **Method**: `POST`
*   **Endpoint**: `/datasets/upload`
*   **Description**: Upload a new file to the server for analysis.
*   **Input**: A file object (multipart/form-data). key: [file](file:///home/dinujaya/fyp/testing-ui/server/dataset_handler.py#187-204).
*   **Output**: An object containing the new `dataset_id` (filename), the file size, and other metadata.

#### List Datasets
*   **Method**: `GET`
*   **Endpoint**: `/datasets`
*   **Description**: Retrieve a list of all file datasets currently stored on the server.
*   **Input**: None.
*   **Output**: A list of dataset objects. Each object includes the [id](file:///home/dinujaya/fyp/testing-ui/server/app/core/interfaces.py#50-56) (used for analysis), `filename`, and `size_bytes`.

### 2. Processor (Algorithm) Functionality

#### List Processors
*   **Method**: `GET`
*   **Endpoint**: `/processors`
*   **Description**: Discover available analysis algorithms.
*   **Input**: None.
*   **Output**: A list of processor objects. Each object contains:
    *   `name`: Unique identifier for the algorithm (e.g., "TMSI Classifier", "FFT Analysis").
    *   `description`: Human-readable summary of what the algorithm does.
    *   `result_type`: A hint for the UI on how to visualize the output (e.g., "classification", "spectrum").

#### Get Processor Configuration
*   **Method**: `GET`
*   **Endpoint**: `/processors/{name}/config`
*   **Description**: Retrieve the configuration parameters required by a specific algorithm.
*   **Input path param**: `name` (The exact name returned by List Processors).
*   **Output**: A JSON Schema object describing the fields.
    *   Example fields might include: `window_sec` (number), [frequencies](file:///home/dinujaya/fyp/testing-ui/server/tmsi_core.py#286-314) (list of numbers), `log_scale` (boolean).
    *   The UI should use this schema to generate the settings form.

### 3. Analysis Execution

#### Run Analysis
*   **Method**: `POST`
*   **Endpoint**: `/analysis/run`
*   **Description**: Execute a specific processor on a specific dataset using provided configuration values.
*   **Input**: A JSON object containing:
    *   `dataset_id`: The ID of the file to analyze (from List Datasets).
    *   `processor_name`: The name of the algorithm to run (from List Processors).
    *   [config](file:///home/dinujaya/fyp/testing-ui/server/app/core/interfaces.py#13-20): A dictionary of values matching the Configuration Schema.
*   **Output**: An analysis result object.
    *   `type`: Matches the `result_type` of the processor (e.g., "spectrum").
    *   [data](file:///home/dinujaya/fyp/testing-ui/server/dataset_handler.py#115-159): The raw data for visualization.
        *   For **Spectrum**: Contains [frequencies](file:///home/dinujaya/fyp/testing-ui/server/tmsi_core.py#286-314) (x-axis) and `magnitudes` (y-axis).
        *   For **Classification**: Contains `scores` (for each class/frequency) and `best_frequency`.

## Data Types & Visualization Guide

The `result_type` field tells the UI which visualization component to use.

| Result Type | Description | Expected Data Structure | UI Component Recommendation |
| :--- | :--- | :--- | :--- |
| `classification` | Classification scores or probabilities. | `best_frequency` (float), `scores` (dictionary of label -> score), `confidence` (float). | Bar chart of scores, or a simple text Highlight showing the best match. |
| `spectrum` | Frequency domain representation. | [frequencies](file:///home/dinujaya/fyp/testing-ui/server/tmsi_core.py#286-314) (array of floats), `magnitudes` (array of floats), `n_channels_averaged` (int). | Line chart. X-axis = Frequencies, Y-axis = Magnitudes. |
