import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loadAuth2 } from "gapi-script"; // IMPORTANT FOR SOME REASON DONT REALLY KNOW WHY LOL DONT QUESTION IT

import "./MapPage.css";
import MultiRangeSlider from "../components/MultiRangeSlider";
import NodeInformation from "../components/NodeInformation";
import GEEMap from "../components/GEEMap";

import { setDropDown, toggleLayerVisibility } from "../store/slices/common";

const MapComponent = () => {
  const [range, setRange] = useState({
    min: 0,
    max: 0,
  });

  const dispatch = useDispatch();

  const layers = useSelector((state) => state.common.layers);
  const dropdown = useSelector((state) => state.common.dropdown);

  const selectDropdown = (dropdownKey) => {
    dispatch(setDropDown(dropdown === dropdownKey ? null : dropdownKey));
  };

  const toggleLayer = (layerName) => {
    const layer = layers[layerName];
    if (layer && layer.tileLayer) {
      layer.tileLayer.setOpacity(layer.visible ? 0 : 1);
      dispatch(toggleLayerVisibility({ layerName }));
    }
  };

  return (
    <div>
      <NodeInformation />
      <div className="top-bar-container">
        <button className="top-bar-menu">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="24px"
            viewBox="0 -960 960 960"
            width="24px"
            fill="#e8eaed"
          >
            <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z" />
          </svg>
        </button>

        <button
          className="top-bar-filters"
          onClick={() => selectDropdown("layers")}
        >
          Layers ({Object.keys(layers).length})
        </button>

        <div
          className={`layer-dropdown ${dropdown === "layers" ? "visible" : ""}`}
        >
          <ul>
            {Object.keys(layers).map((layerName) => (
              <li key={layerName}>
                <label>
                  <input
                    type="checkbox"
                    checked={layers[layerName].visible || false}
                    onChange={() => toggleLayer(layerName)}
                  />
                  <div className="checkbox__checkmark"></div>
                  <div className="checkbox__body">{layerName}</div>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="search-bar">
          <input type="text" placeholder="Search Locations" />
        </div>
      </div>

      <div className="bottom-bar-container">
        {/* <MultiRangeSlider
          min={0}
          max={1000}
          onChange={({ min, max }) => setRange({ min, max })}
        /> */}
        <div className="range-background"></div>
      </div>

      <GEEMap />
    </div>
  );
};

const MapPage = () => {
  return (
    <>
      <MapComponent />;
    </>
  );
};

export default MapPage;
