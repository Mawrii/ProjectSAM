#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Keypad.h>
#include <WiFi.h>
#include <WebSocketsClient.h>

// WiFi Credentials
const char* ssid = "H369A262C6E";
const char* password = "246CF9EF4DA2";

// WebSocket Server
const char* websocket_server = "145.24.222.63";  // Change to your server's IP or domain
const uint16_t websocket_port = 8001;
const char* websocket_path = "/"; 
WebSocketsClient webSocket;

#define SS_PIN 5
#define RST_PIN 0

const byte ROWS = 4;
const byte COLS = 4;
MFRC522 rfid(SS_PIN, RST_PIN);
MFRC522::MIFARE_Key key;
byte nuidPICC[4];

char hexaKeys[ROWS][COLS] = {
    {'1', '2', '3', 'A'},
    {'4', '5', '6', 'B'},
    {'7', '8', '9', 'C'},
    {'*', '0', '#', 'D'}};

byte rowPins[ROWS] = {13, 12, 14, 27};
byte colPins[COLS] = {26, 25, 33, 32};
Keypad customKeypad = Keypad(makeKeymap(hexaKeys), rowPins, colPins, ROWS, COLS);

String currentPage = "rfid"; // Start on the RFID page

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            Serial.println("WebSocket Disconnected!");
            break;
        case WStype_CONNECTED:
            Serial.println("WebSocket Connected!");
            break;
        case WStype_TEXT:
            Serial.printf("Message from Server: %s\n", payload);
            break;
    }
}

void setup() {
    Serial.begin(115200);
    SPI.begin();
    rfid.PCD_Init();

    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi...");
    while (WiFi.status() != WL_CONNECTED) {
        Serial.print(".");
        delay(500);
    }
    Serial.println("\nConnected to WiFi");

    webSocket.begin(websocket_server, websocket_port, websocket_path);
    webSocket.onEvent(webSocketEvent);

    // Optional: Visual indicator (blink onboard LED on GPIO 2)
    pinMode(2, OUTPUT);
    digitalWrite(2, HIGH);
    delay(300);
    digitalWrite(2, LOW);
    delay(300);
    digitalWrite(2, HIGH);
    delay(300);
    digitalWrite(2, LOW);

    // Show keypad is ready
    Serial.println("Numpad ready. Press any key...");
    webSocket.sendTXT("{\"type\": \"status\", \"value\": \"Numpad ready\"}");
}

void loop() {
    webSocket.loop();

    char customKey = customKeypad.getKey();
    if (customKey) {
        Serial.print("Key Pressed: ");
        Serial.println(customKey);

        if (customKey == 'A') {
            currentPage = "rfid";
        } else if (customKey == 'B') {
            currentPage = "withdraw";
        }

        String jsonMessage = "{\"type\": \"keypad\", \"page\": \"" + currentPage + "\", \"value\": \"" + String(customKey) + "\"}";
        webSocket.sendTXT(jsonMessage);
    }

    if (currentPage == "rfid") {
        if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
            Serial.println("A new card has been detected.");
            String rfidHex = "";
            for (byte i = 0; i < rfid.uid.size; i++) {
                if (rfid.uid.uidByte[i] < 0x10) rfidHex += "0";
                rfidHex += String(rfid.uid.uidByte[i], HEX);
            }

            String jsonMessage = "{\"type\": \"rfid\", \"value\": \"" + rfidHex + "\"}";
            webSocket.sendTXT(jsonMessage);

            rfid.PICC_HaltA();
            rfid.PCD_StopCrypto1();
        }
    }
}
