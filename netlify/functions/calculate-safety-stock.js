const { safetyStockCalculator } = require('../../server/services/safetyStockCalculator');
const { Handler } = require('@netlify/functions');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const { historyData, itemMaster } = JSON.parse(event.body);
    const results = safetyStockCalculator.calculateHistoryBased(historyData, itemMaster);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(results)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};