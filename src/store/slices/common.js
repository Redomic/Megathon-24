import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  loading: false,
  canvas: {
    lat: 0,
    long: 0,
    dragging: false,
  },
  dropdown: null,
  layers: {},
  poi: [],
};

export const commonSlice = createSlice({
  name: "common",
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setDropDown: (state, action) => {
      state.dropdown = action.payload;
    },
    setPosition: (state, action) => {
      state.canvas.lat = action.payload.x;
      state.canvas.long = action.payload.y;
    },
    setDragging: (state, action) => {
      state.canvas.dragging = action.payload;
    },
    addLayer: (state, action) => {
      const { layerName } = action.payload;
      state.layers[layerName] = { visible: true };
    },
    toggleLayerVisibility: (state, action) => {
      const { layerName } = action.payload;
      const layer = state.layers[layerName];
      if (layer) {
        layer.visible = !layer.visible;
      }
    },
    setPOI: (state, action) => {
      state.poi = [...state.poi, action.payload];
    },
  },
});

export const {
  setLoading,
  setDropDown,
  setPosition,
  setDragging,
  addLayer,
  toggleLayerVisibility,
  setPOI,
} = commonSlice.actions;

export default commonSlice.reducer;
