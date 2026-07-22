const mqtt = require('mqtt');

let mqttConnected = false; // Track MQTT connection status

const mqttClient = mqtt.connect(process.env.mqtt_broker_url, {
    username: process.env.mqttUser,
    password: process.env.mqttPassword,
});

mqttClient.on('connect', () => {
    mqttConnected = true;
    console.log(`✅ MQTT Connected (${process.env.mqtt_broker_url})`);
});

mqttClient.on('reconnect', () => {
    console.log('🔄 MQTT Reconnecting...');
});

mqttClient.on('close', () => {
    mqttConnected = false;
    console.warn('⚠️ MQTT Connection Closed');
});

mqttClient.on('offline', () => {
    mqttConnected = false;
    console.warn('⚠️ MQTT Client Offline');
});

mqttClient.on('error', (err) => {
    mqttConnected = false;
    console.error('❌ MQTT Connection Error:', err.message);
});

// Function to check MQTT connection status dynamically
const isMqttConnected = () => mqttConnected;

module.exports = { mqttClient, isMqttConnected };
