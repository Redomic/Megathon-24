import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import Papa from "papaparse";
import { DecisionTreeClassifier } from "scikitjs";
import * as tf from "@tensorflow/tfjs";
import { GoogleMap, LoadScript, DrawingManager } from "@react-google-maps/api";
import { addLayer, setAlert, setLoading } from "../store/slices/common";

import "./GEEMap.css";
import LoadingOverlay from "./LoadingOverlay";

const containerStyle = {
  width: "100vw",
  height: "100vh",
};

const center = {
  lat: 16.5417,
  lng: 80.515,
};

const darkModeStyle = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000000" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3d3d3d" }],
  },
];

const GEEMap = () => {
  const [map, setMap] = useState(null); // Store the map instance
  const [authenticated, setAuthenticated] = useState(false); // Track authentication
  const [initializedGEE, setInitializedGEE] = useState(false); // Track GEE initialization status
  const [errorMessage, setErrorMessage] = useState(""); // Store any error messages
  const [drawingMode, setDrawingMode] = useState(false); // To track drawing mode
  const [rectangles, setRectangles] = useState([]);
  const [prod, setProd] = useState(0);

  const dispatch = useDispatch();

  // Handle rectangle complete event

  useEffect(() => {
    dispatch(setLoading(true));
    if (!initializedGEE) {
      const loadEarthEngineScript = () => {
        const script = document.createElement("script");
        script.src =
          "https://ajax.googleapis.com/ajax/libs/earthengine/0.1.365/earthengine-api.min.js";
        script.async = true;
        script.onload = () => initializeGEE(); // Load and initialize GEE
        document.body.appendChild(script);
      };

      const initializeGEE = () => {
        if (window.ee) {
          window.ee.data.authenticateViaOauth(
            process.env.REACT_APP_GOOGLE_CLIENT_ID,
            () => {
              window.ee.initialize(
                null,
                null,
                () => {
                  console.log("GEE initialized");
                  setAuthenticated(true); // Set authenticated to true
                  setInitializedGEE(true); // GEE is initialized
                  if (map) addEarthEngineLayer(map); // Add layer if map is already loaded
                  dispatch(setLoading(false));
                },
                (error) => {
                  console.error("Error initializing GEE:", error);
                  setErrorMessage("Error initializing GEE: " + error.message);
                  dispatch(setLoading(false));
                }
              );
            },
            (error) => {
              console.error("Authentication error:", error);
              setErrorMessage("Authentication error: " + error.message);
              dispatch(setLoading(false));
            },
            [
              "https://www.googleapis.com/auth/earthengine.readonly",
              "https://www.googleapis.com/auth/cloud-platform",
              "https://www.googleapis.com/auth/drive",
            ],
            null,
            true
          );
        } else {
          setErrorMessage("Earth Engine API failed to load.");
          dispatch(setLoading(false));
        }
      };

      loadEarthEngineScript(); // Load Earth Engine script
      dispatch(setLoading(false));
    }
  }, [map, initializedGEE]); // Dependency includes `map` and `initializedGEE`

  // Function to mask the edges
  function maskEdge(image) {
    var edge = image.lt(-30.0); // Threshold to mask edges
    var maskedImage = image.mask().and(edge.not()); // Combine with mask
    return image.updateMask(maskedImage); // Apply updated mask
  }

  // Function to apply Lee filter
  function applyLeeFilter(image) {
    var kernelSize = 3; // Define kernel size for Lee filter
    var nat = window.ee.Image.constant(10).pow(image.divide(10)); // Convert to natural scale (from dB)
    var kernel = window.ee.Kernel.square({
      radius: kernelSize,
      units: "pixels",
    }); // Square kernel
    var mean = nat.reduceNeighborhood({
      reducer: window.ee.Reducer.mean(),
      kernel: kernel,
    }); // Local mean
    var variance = nat.reduceNeighborhood({
      reducer: window.ee.Reducer.variance(),
      kernel: kernel,
    }); // Local variance

    var weight = variance.divide(variance.add(window.ee.Image.constant(0.01))); // Compute weighting factor

    var result = window.ee.Image.constant(1)
      .subtract(weight)
      .multiply(mean)
      .add(weight.multiply(nat)); // Apply filter

    return window.ee.Image(result).log10().multiply(10); // Convert back to dB scale
  }

  // Function to apply iterative Lee filter
  function iterativeLeeFilter(image, iterations) {
    for (var i = 0; i < iterations; i++) {
      image = applyLeeFilter(image);
    }
    return image;
  }

  // Function to apply spatial smoothing
  function applySpatialSmoothing(image, kernelSize, smoothingFactor) {
    var kernel = window.ee.Kernel.square({
      radius: kernelSize,
      units: "pixels",
    }); // Square kernel
    var smoothed = image.convolve(kernel); // Apply convolution with kernel

    // Smooth the image with the given factor
    return window.ee
      .Image(1)
      .subtract(window.ee.Image.constant(smoothingFactor))
      .multiply(image)
      .add(window.ee.Image.constant(smoothingFactor).multiply(smoothed));
  }

  // Function for connected pixel aggregation
  function connectedPixelAggregation(clusteredImage, minSize) {
    minSize = minSize || 15; // Default to 15 if not provided
    var connected = clusteredImage.connectedPixelCount(); // Count connected pixels
    var largeClusters = connected.gte(minSize); // Mask small clusters
    return clusteredImage.updateMask(largeClusters); // Apply mask
  }

  // Function to apply majority filter (mode filtering)
  function majorityFilter(image, kernelSize, smoothingFactor) {
    var kernel = window.ee.Kernel.square({
      radius: kernelSize,
      units: "pixels",
    }); // Square kernel
    var mode = image.reduceNeighborhood({
      reducer: window.ee.Reducer.mode(),
      kernel: kernel,
    }); // Compute mode

    // Combine original and smoothed mode image
    return window.ee
      .Image(1)
      .subtract(window.ee.Image.constant(smoothingFactor))
      .multiply(image)
      .add(window.ee.Image.constant(smoothingFactor).multiply(mode));
  }

  // Homogeneous K-means clustering
  function homogeneousKmeansClustering(
    image,
    region,
    nClusters,
    scale,
    numPixels,
    seed,
    smoothingFactor,
    kernelSize
  ) {
    // Set default parameters
    scale = scale || 30;
    numPixels = numPixels || 100000;
    seed = seed || 42;
    smoothingFactor = smoothingFactor || 0.5;
    kernelSize = kernelSize || 2;

    // Apply spatial smoothing
    var smoothedImage = applySpatialSmoothing(
      image,
      kernelSize,
      smoothingFactor
    );

    // Sample the region for clustering
    var training = smoothedImage.sample({
      region: region,
      scale: scale,
      numPixels: numPixels,
      seed: seed,
    });

    // Apply K-means clustering
    var clusterer = window.ee.Clusterer.wekaKMeans(nClusters).train(training);
    var clustered = smoothedImage.cluster(clusterer);

    // Aggregate connected pixels to remove small clusters
    var aggregated = connectedPixelAggregation(clustered);

    // Apply majority filter to smooth the result
    var result = majorityFilter(aggregated, kernelSize, smoothingFactor);

    return result;
  }

  const addEarthEngineLayer = async (mapInstance) => {
    if (!authenticated || !mapInstance) return; // Only proceed if authenticated and map exists

    dispatch(setLoading(true));
    try {
      // Load Sentinel-1 Image Collection and apply the iterative Lee filter
      const img = window.ee
        .ImageCollection("COPERNICUS/S1_GRD")
        .filter(window.ee.Filter.date("2021-01-01", "2021-12-31"))
        .filter(
          window.ee.Filter.listContains("transmitterReceiverPolarisation", "VV")
        )
        .filter(window.ee.Filter.eq("instrumentMode", "IW"))
        .filter(window.ee.Filter.eq("orbitProperties_pass", "DESCENDING"))
        .select("VV")
        .mean();

      // const roi = window.ee.Geometry.Polygon([
      //   [
      //     [79.40094582712027, 29.951060610759924],
      //     [79.40094582712027, 29.887282737412633],
      //     [79.49784421648269, 29.887282737412633],
      //     [79.49784421648269, 29.951060610759924],
      //   ],
      // ]);

      // const lee_filtered = iterativeLeeFilter(img, 3);

      // const clustered = homogeneousKmeansClustering(lee_filtered, roi, 3, 0, 0);

      // const masked = maskEdge(clustered);

      // const maskedMapLayer = await masked.getMap({
      //   min: 0,
      //   max: 3,
      //   palette: ["blue", "green", "red"],
      // });

      const s1MapLayer = await img.getMap({
        min: -25,
        max: 0,
      });

      console.log("sentinel map layer: ", s1MapLayer);
      if (s1MapLayer) {
        const s1TileLayer = new window.google.maps.ImageMapType({
          getTileUrl: (tile, zoom) => {
            const url = s1MapLayer.urlFormat
              .replace("{z}", zoom)
              .replace("{x}", tile.x)
              .replace("{y}", tile.y);
            return url;
          },
          tileSize: new window.google.maps.Size(256, 256),
          name: "s1 layer",
        });

        mapInstance.overlayMapTypes.push(s1TileLayer);
        dispatch(addLayer({ layerName: "Sentinel" }));
        dispatch(setLoading(false));

        // mapInstance.overlayMapTypes.push(maskedTileLayer);
        // dispatch(addLayer({ layerName: "Clustered" }));
      } else {
        console.error("Failed to retrieve map layers.");
        dispatch(setLoading(false));
      }
    } catch (error) {
      console.error("Error loading Sentinel-1 layer:", error);
      dispatch(setLoading(false));
    }
  };

  const handleMapLoad = (mapInstance) => {
    setMap(mapInstance); // Set the map instance
    if (authenticated) {
      addEarthEngineLayer(mapInstance); // Add Earth Engine layer if authenticated
    }
  };

  const applyClusterLayer = async (bounds) => {
    if (!authenticated) return; // Ensure user is authenticated before proceeding
    dispatch(setLoading(true));

    try {
      // Extract the coordinates from the bounds object
      const southWest = bounds.getSouthWest();
      const northEast = bounds.getNorthEast();

      // Define the region using the bounds' coordinates in the required [lon, lat] format

      const roi = window.ee.Geometry.Polygon([
        [
          [79.40094582712027, 29.951060610759924],
          [79.40094582712027, 29.887282737412633],
          [79.49784421648269, 29.887282737412633],
          [79.49784421648269, 29.951060610759924],
        ],
      ]);

      var startDate = "2023-01-01";
      var endDate = "2023-01-31";

      // Load CHIRPS daily precipitation data
      var chirps = window.ee
        .ImageCollection("UCSB-CHG/CHIRPS/DAILY")
        .filterBounds(roi)
        .filterDate(startDate, endDate);

      // Calculate daily precipitation (in mm)
      var dailyPrecip = chirps.select("precipitation").mean().clip(roi);
      var smap = window.ee
        .ImageCollection("NASA_USDA/HSL/SMAP10KM_soil_moisture")
        .filterBounds(roi)
        .filterDate(startDate, endDate);

      // Get daily surface soil moisture (in m^3/m^3)
      var dailySoilMoisture = smap.select("ssm").mean().clip(roi);

      fetch("http://localhost:5000/predict", {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "omit",
        body: JSON.stringify(dailyPrecip, dailySoilMoisture),
      })
        .then((response) => response.json())
        .then((result) => {
          console.log("Result:", result);
        })
        .catch((error) => {
          console.error("Error:", error);
        });

      const clickedArea = window.ee.Geometry.Rectangle([
        southWest.lng(), // West (Longitude)
        southWest.lat(), // South (Latitude)
        northEast.lng(), // East (Longitude)
        northEast.lat(), // North (Latitude)
      ]);

      // Log ROI for debugging
      console.log("ROI defined as:", roi);

      // Fetch Sentinel-1 data and apply clustering over the clicked area
      const img = window.ee
        .ImageCollection("COPERNICUS/S1_GRD")
        .filter(window.ee.Filter.date("2021-10-03", "2021-12-31"))
        .filter(
          window.ee.Filter.listContains("transmitterReceiverPolarisation", "VV")
        )
        .filter(window.ee.Filter.eq("instrumentMode", "IW"))
        .filter(window.ee.Filter.eq("orbitProperties_pass", "DESCENDING"))
        .select("VV")
        .mean();

      const lee_filtered = iterativeLeeFilter(img, 3);

      // Apply clustering on the selected region (ROI)
      const clustered = homogeneousKmeansClustering(lee_filtered, roi, 3, 0, 0);

      const masked = maskEdge(clustered).clip(clickedArea);

      const maskedMapLayer = await masked.getMap({
        min: 0,
        max: 3,
        palette: ["red", "blue", "yellow"],
      });

      console.log("Mask Layer: ", maskedMapLayer);

      if (maskedMapLayer) {
        const maskedTileLayer = new window.google.maps.ImageMapType({
          getTileUrl: (tile, zoom) => {
            const url = maskedMapLayer.urlFormat
              .replace("{z}", zoom)
              .replace("{x}", tile.x)
              .replace("{y}", tile.y);
            return url;
          },
          tileSize: new window.google.maps.Size(256, 256),
          name: "Clustered Layer",
        });

        // if (map.overlayMapTypes.length > 0) {
        //   map.overlayMapTypes.pop();
        // }
        map.overlayMapTypes.push(maskedTileLayer);
        dispatch(setLoading(false));
        // dispatch(addLayer({ layerName: "Clustered" }));
      }
    } catch (error) {
      console.error("Error applying clustered layer:", error);
      dispatch(setLoading(false));
    }
  };

  const onRectangleComplete = (rect) => {
    const bounds = rect.getBounds();
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();
    setRectangles((prevRectangles) => [
      ...prevRectangles,
      {
        instance: rect,
        coords: {
          northEast: {
            lat: northEast.lat(),
            lng: northEast.lng(),
          },
          southWest: {
            lat: southWest.lat(),
            lng: southWest.lat(),
          },
        },
      },
    ]);
    setDrawingMode(false); // Disable drawing mode
    rect.setEditable(false); // Disable rectangle editing after drawing
    rect.setDraggable(false); // Disable dragging after drawing

    // Add a click listener to the rectangle
    window.google.maps.event.addListener(rect, "click", () => {
      console.log("Rectangle clicked:", {
        northEast,
        southWest,
      });

      if (map) {
        map.fitBounds(bounds); // Fit the bounds of the clicked rectangle

        // Remove existing overlay layers if any
        // if (map.overlayMapTypes.length > 0) {
        //   map.overlayMapTypes.pop(); // Remove previous layers to ensure only one layer is active
        // }

        console.log("CLICKED");

        rect.setOptions({
          fillColor: "#000",
          // strokeColor: "#0000FF",
        });

        applyClusterLayer(bounds);
        dispatch(setAlert(true));
      }
    });
  };

  // Render DrawingManager only when drawing mode is active
  const renderDrawingManager = () => {
    return drawingMode ? (
      <DrawingManager
        drawingMode={window.google.maps.drawing.OverlayType.RECTANGLE}
        onRectangleComplete={onRectangleComplete} // Handle rectangle completion
        options={{
          drawingControl: false, // Hide drawing controls
          rectangleOptions: {
            fillColor: "#ff0000",
            fillOpacity: 0.2,
            strokeWeight: 2,
            clickable: true,
            editable: true,
            zIndex: 1,
          },
        }}
      />
    ) : null;
  };

  return (
    <>
      <div className="bottom-right">
        <button onClick={() => setDrawingMode(true)}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="24px"
            viewBox="0 -960 960 960"
            width="24px"
            fill="#FFF"
          >
            <path d="M160-120v-170l527-526q12-12 27-18t30-6q16 0 30.5 6t25.5 18l56 56q12 11 18 25.5t6 30.5q0 15-6 30t-18 27L330-120H160Zm80-80h56l393-392-28-29-29-28-392 393v56Zm560-503-57-57 57 57Zm-139 82-29-28 57 57-28-29ZM560-120q74 0 137-37t63-103q0-36-19-62t-51-45l-59 59q23 10 36 22t13 26q0 23-36.5 41.5T560-200q-17 0-28.5 11.5T520-160q0 17 11.5 28.5T560-120ZM183-426l60-60q-20-8-31.5-16.5T200-520q0-12 18-24t76-37q88-38 117-69t29-70q0-55-44-87.5T280-840q-45 0-80.5 16T145-785q-11 13-9 29t15 26q13 11 29 9t27-13q14-14 31-20t42-6q41 0 60.5 12t19.5 28q0 14-17.5 25.5T262-654q-80 35-111 63.5T120-520q0 32 17 54.5t46 39.5Z" />
          </svg>
        </button>
      </div>
      <LoadScript
        googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_KEY}
        libraries={["drawing"]}
      >
        {authenticated && !errorMessage ? (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={10}
            onLoad={handleMapLoad} // Call onLoad to store map instance
            options={{
              styles: darkModeStyle,
              disableDefaultUI: true,
              zoomControl: false,
              mapTypeControl: false,
              streetViewControl: false,
            }}
          >
            {renderDrawingManager()}
          </GoogleMap>
        ) : (
          <LoadingOverlay />
        )}
      </LoadScript>
    </>
  );
};

export default GEEMap;
