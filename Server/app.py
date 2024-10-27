from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd

app = Flask(__name__)
CORS(app, resources={r"/predict": {"origins": "http://localhost:3000"}}, supports_credentials=True)

# Load the saved model
with open('model.joblib', 'rb') as f:
    model = joblib.load(f)

@app.route('/predict', methods=['POST', 'OPTIONS'])
def predict():
    if request.method == 'OPTIONS':
        response = app.response_class()
        response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response

    data = request.get_json()
    rainfall = data.get('rainfall_mm')
    soil_moisture = data.get('soil_moisture')
    
    # Check that both inputs are provided
    if rainfall is None or soil_moisture is None:
        return jsonify({'error': 'Invalid input. Both rainfall_mm and soil_moisture are required.'}), 400

    # Create a DataFrame with the input data
    input_data = pd.DataFrame([[rainfall, soil_moisture]], columns=['rainfall_mm', 'soil_moisture'])
    
    # Make prediction
    prediction = model.predict(input_data)[0]  # Get the predicted class (0 or 1 for flooded or not flooded)
    
    # Return the result as JSON
    response = jsonify({'flooded': int(prediction)})
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
    return response

if __name__ == '__main__':
    app.run(debug=True)