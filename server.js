const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const storage = multer.memoryStorage(); // Stores the file in memory
const upload = multer({ storage: storage });
const express = require('express');
const app = express();
require('dotenv').config();

// Enable CORS
app.use(cors());
app.use(express.json());

const subscriptionKey = process.env.AZURE_SUBSCRIPTION_KEY;
const endpoint = process.env.AZURE_OCR_ENDPOINT;

const ocrUrl = `${endpoint}/vision/v3.2/read/analyze`;


app.post('/analyze', upload.single('file'), async (req, res) => {
    // Get the image buffer from the uploaded file
    const imageData = req.file.buffer;

    try {
        // Make a POST request to the Azure OCR API with the image buffer
        const response = await axios.post(ocrUrl, imageData, {
            headers: {
                'Ocp-Apim-Subscription-Key': subscriptionKey,
                'Content-Type': 'application/octet-stream'
            }
        });

        // Get the operation location from the headers (asynchronous processing)
        const operationUrl = response.headers['operation-location'];

        // Poll the OCR result until it's ready
        let ocrResult;
        do {
            // Wait for 2 seconds before each poll
            await new Promise(r => setTimeout(r, 2000));

            // Fetch the results using the operation location
            const resultResponse = await axios.get(operationUrl, {
                headers: {
                    'Ocp-Apim-Subscription-Key': subscriptionKey
                }
            });

            ocrResult = resultResponse.data;
        } while (ocrResult.status !== 'succeeded');

        // Extract the text from the OCR results
        const extractedText = ocrResult.analyzeResult.readResults
            .map(page => page.lines.map(line => line.text).join(' '))
            .join('\n');

        // Send the extracted text as the response
        res.json({ text: extractedText });
    } catch (error) {
        console.error('Failed to analyze image:', error.message);
        res.status(500).send(error.message);
    }
});

app.listen(8000, () => {
    console.log('Server started on port 8000');
});
