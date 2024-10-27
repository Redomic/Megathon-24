import React from "react";
import "./NodeInformation.css";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

const NodeInformation = ({ isMoreInfo = false }) => {
  const visible = useSelector((state) => state.common.alert);

  const colorHandler = (node) => {
    if (node.flag === "Normal") {
      return node.rating >= 5.0 ? "normal" : "suspicious";
    } else if (node.flag === "Criminal") {
      return "criminal";
    } else if (node.flag === "Official") {
      return "official";
    } else {
      return "";
    }
  };

  const percentageHandler = (node) => {
    if (node.flag === "Normal") {
      return node.rating * 10;
    } else if (node.flag === "Criminal" || node.flag === "Official") {
      return 100;
    } else {
      return 0;
    }
  };

  const scoreHandler = (node) => {
    if (node.flag === "Normal") {
      return node.rating;
    } else if (node.flag === "Criminal") {
      return "Criminal";
    } else if (node.flag === "Official") {
      return "Official";
    } else {
      return "NaN";
    }
  };

  // Only render the component if `visible` is true
  if (!visible) return null;

  return (
    <div className="node-info-container">
      <div className={`node-info`}>
        <div className="node-info__header">
          <h2>Flood / Drought</h2>
          {!isMoreInfo ? (
            <Link>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M6 10C4.9 10 4 10.9 4 12C4 13.1 4.9 14 6 14C7.1 14 8 13.1 8 12C8 10.9 7.1 10 6 10ZM18 10C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14C19.1 14 20 13.1 20 12C20 10.9 19.1 10 18 10ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z"
                  fill="white"
                />
              </svg>
            </Link>
          ) : null}
        </div>

        <div className="flex-wrapper">
          <div className="single-chart">
            <svg viewBox="0 0 36 36" className="circular-chart normal">
              <path
                className="circle-bg "
                d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="circle"
                strokeDasharray="70, 100"
                d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <text x="18" y="20.35" className="percentage">
                Prone
              </text>
              <text x="18" y="25" className="bottom-text">
                Region
              </text>
            </svg>
          </div>
        </div>

        <div className="node-info__info">
          <div className="node-info__info-header">
            <h5>Region Information</h5>
          </div>
          <div className="node-info__info-container">
            <span>Probability: 86%</span>
          </div>
        </div>

        <div className="node-info__info">
          <div className="node-info__info-header">
            <h5>Model Information</h5>
          </div>
          <div className="node-info__info-container">
            <span>Accuracy: 91%</span>
            <span>Recall: 0.92</span>
            <span>Precision: 0.90</span>
            <span>Execution Time: ---</span>
          </div>
        </div>

        {isMoreInfo ? (
          <button
            className="node-info__chat-btn"
            onClick={() => console.log("clicked")}
          >
            Block Bot
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default NodeInformation;
