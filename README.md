# Satellite-Insights

## Final Submission

- [Website](https://sidharthsawhney.github.io/Satellite-Insights/)
- [Process Book (published)](https://docs.google.com/document/d/e/2PACX-1vRnG52RV1YLasZ_MXQ8asRgkfUvOAmWSlokavYUlhQyUu_rBk5JzZzhmTlTXTtgjAB0K5_Q_NpAowoz/pub), link to [edit process book](https://docs.google.com/document/d/1oAKEedT2gigzB93vuCZJ51oUiNDFOCm_htbLkDPk-7Y/edit?usp=sharing).
- [Video Walkthrough](https://youtu.be/VkGncY8YOQk?si=CjYhpv2zQ4Fnvq04)
- [GitHub Repository](https://github.com/SidharthSawhney/Satellite-Insights)

## Notes on "Hidden" Features

- Satellite Launches by Location
  - Hover over the **i** icon to get more information about the map
- Government vs Commercial Satellites Launched
  - Hover over bars to get information per year for that sector group
  - Hover over the **i** icon to learn about how the 3-year average is calculated
- Cumulative Satellites Launched per Major Rocket
  - Select a rocket by clicking its name on the legend
- Launch vs Power Visualization
  - Click on the labels to filter by mass groups
- Orbital Congestion
  - In the full view, hover over a satellite's orbit to see the satellite name and orbit class

## Data Sources

The project uses data from the Union of Concerned Scientists (UCS) Satellite Database, which has been cleaned and processed for visualization purposes. 
Link to [dataset](https://www.ucs.org/resources/satellite-database).

## Folder Layout

All libraries are imported online in the `index.html` file using the following code chunk:

```html
<!-- Libraries -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
    crossorigin="anonymous"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://unpkg.com/topojson-client@3"></script>
```

### File Structure

- `index.html`: Main file to launch the site
- `pre-model.ipynb`: Data cleaning and exploratory data analysis (EDA)

### Directory Structure

- `css/`
  Contains all CSS files, including:
  - `main.css`
  - CSS files for each respective visualization

- `data/`
  Contains datasets for satellites and additional information:
  - `UCS-satellite.xlsx`: Original dataset from the website
  - `satellite_clean.csv`: Cleaned version of the dataset in CSV format
  - `satellite_clean.json`: Cleaned version of the dataset in JSON format
  - `launch_dominance.json`: Contains all launch sites and the number of rockets launched, extracted from `satellite_clean.csv`. Used for launch dominance visualization.
  - `world_lowres.json`: Contains GeoJSON data for the world map in the launch-sites-map (Satellite Launches by Location) visualization

- `js/`
  Contains all JavaScript files, including:
  - `main.js`
  - JavaScript files for all respective visualizations

- `images/`
  Contains all images used for the website