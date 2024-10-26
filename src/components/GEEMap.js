// GEEMap.jsx

import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import { addLayer, setLoading } from "../store/slices/common";

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
  // Your dark mode styles here
];

const GEEMap = () => {
  const [map, setMap] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [initializedGEE, setInitializedGEE] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [rectangles, setRectangles] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [rectangleCreated, setRectangleCreated] = useState(false);

  const dispatch = useDispatch();

  // Get user's location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
      },
      (error) => {
        console.error("Error getting user location:", error);
        setErrorMessage("Error getting user location.");
      }
    );
  }, []);

  // Initialize Google Earth Engine
  useEffect(() => {
    if (!initializedGEE) {
      dispatch(setLoading(true));

      const loadEarthEngineScript = () => {
        const script = document.createElement("script");
        script.src =
          "https://ajax.googleapis.com/ajax/libs/earthengine/0.1.365/earthengine-api.min.js";
        script.async = true;
        script.onload = () => initializeGEE();
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
                  setAuthenticated(true);
                  setInitializedGEE(true);
                  if (map) addEarthEngineLayer(map);
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

      loadEarthEngineScript();
    }
  }, [map, initializedGEE, dispatch]);

  // Function to calculate bounds for 1km x 1km rectangle
  function calculateBounds(center, halfSideInKm) {
    const earthRadiusKm = 6371;
    const lat = center.lat * (Math.PI / 180); // Convert latitude to radians

    // Latitude: 1 degree ≈ 111 km
    const deltaLat = (halfSideInKm / earthRadiusKm) * (180 / Math.PI);

    // Longitude: degrees per km varies with latitude
    const deltaLng =
      (halfSideInKm / (earthRadiusKm * Math.cos(lat))) * (180 / Math.PI);

    const north = center.lat + deltaLat;
    const south = center.lat - deltaLat;
    const east = center.lng + deltaLng;
    const west = center.lng - deltaLng;

    return {
      north,
      south,
      east,
      west,
    };
  }

  // Draw rectangle when userLocation and map are available
  useEffect(() => {
    if (userLocation && map && !rectangleCreated) {
      // map.panTo(userLocation);

      const rectangleSizeInKm = 0.5; // Half of the side length (1km x 1km rectangle)
      const bounds = calculateBounds(userLocation, rectangleSizeInKm);

      const rectangle = new window.google.maps.Rectangle({
        bounds: {
          north: bounds.north,
          south: bounds.south,
          east: bounds.east,
          west: bounds.west,
        },
        editable: false,
        draggable: false,
        map: map,
        fillColor: "#ff0000",
        fillOpacity: 0.2,
        strokeWeight: 2,
        clickable: true,
        zIndex: 1,
      });

      const rectangleBounds = new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(bounds.south, bounds.west),
        new window.google.maps.LatLng(bounds.north, bounds.east)
      );

      map.fitBounds(rectangleBounds);

      // Optionally, add a click listener to the rectangle
      rectangle.addListener("click", () => {
        console.log("Rectangle clicked");
        map.fitBounds(rectangleBounds);
        applyClusterLayer(rectangleBounds);
      });

      // Apply the cluster layer for the rectangle's bounds
      applyClusterLayer(rectangleBounds);

      // Update state to prevent re-creating the rectangle
      setRectangleCreated(true);

      // Store rectangle if needed for later use
      setRectangles((prevRectangles) => [
        ...prevRectangles,
        {
          instance: rectangle,
          coords: {
            northEast: {
              lat: bounds.north,
              lng: bounds.east,
            },
            southWest: {
              lat: bounds.south,
              lng: bounds.west,
            },
          },
        },
      ]);
    }
  }, [userLocation, map, rectangleCreated]);

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

  // Function to add Earth Engine layer to the map
  const addEarthEngineLayer = async (mapInstance) => {
    if (!authenticated || !mapInstance) return;

    dispatch(setLoading(true));
    try {
      // Load Sentinel-1 Image Collection
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

      const s1MapLayer = await img.getMap({
        min: -25,
        max: 0,
      });

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
          name: "Sentinel-1 Layer",
        });

        mapInstance.overlayMapTypes.push(s1TileLayer);
        dispatch(addLayer({ layerName: "Sentinel-1" }));
        dispatch(setLoading(false));
      } else {
        console.error("Failed to retrieve map layers.");
        dispatch(setLoading(false));
      }
    } catch (error) {
      console.error("Error loading Sentinel-1 layer:", error);
      dispatch(setLoading(false));
    }
  };

  // Function to apply the clustered layer over the ROI
  const applyClusterLayer = async (bounds) => {
    if (!authenticated) return;
    dispatch(setLoading(true));

    try {
      // Extract the coordinates from the bounds object
      const southWest = bounds.getSouthWest();
      const northEast = bounds.getNorthEast();

      // Define the region using the bounds' coordinates
      const clickedArea = window.ee.Geometry.Rectangle([
        southWest.lng(), // West (Longitude)
        southWest.lat(), // South (Latitude)
        northEast.lng(), // East (Longitude)
        northEast.lat(), // North (Latitude)
      ]);

      // Fetch Sentinel-1 data and apply clustering over the clicked area
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

      const leeFiltered = iterativeLeeFilter(img, 3);

      // Apply clustering on the selected region (ROI)
      const clustered = homogeneousKmeansClustering(
        leeFiltered,
        clickedArea,
        3,
        0,
        0
      );

      const masked = maskEdge(clustered).clip(clickedArea);

      const maskedMapLayer = await masked.getMap({
        min: 0,
        max: 3,
        palette: ["red", "blue", "yellow"],
      });

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

        map.overlayMapTypes.push(maskedTileLayer);

        dispatch(setLoading(false));
      }
    } catch (error) {
      console.error("Error applying clustered layer:", error);
      dispatch(setLoading(false));
    }
  };

  const handleMapLoad = (mapInstance) => {
    setMap(mapInstance);
    if (authenticated) {
      addEarthEngineLayer(mapInstance);
    }
  };

  return (
    <>
      <LoadScript
        googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_KEY}
        // Remove "drawing" library if not needed
        // libraries={["drawing"]}
      >
        {authenticated && !errorMessage ? (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={userLocation || center}
            zoom={14}
            onLoad={handleMapLoad}
            options={{
              styles: darkModeStyle,
              disableDefaultUI: true,
              zoomControl: false,
              mapTypeControl: false,
              streetViewControl: false,
            }}
          >
            {/* No need to render DrawingManager */}
            {userLocation && <Marker position={userLocation} />}
          </GoogleMap>
        ) : (
          <LoadingOverlay />
        )}
      </LoadScript>
    </>
  );
};

export default GEEMap;
