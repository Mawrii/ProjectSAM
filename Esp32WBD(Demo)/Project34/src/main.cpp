#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <Keypad.h>

// WiFi Credentials
const char *ssid = "AI";
const char *password = "Tresax123@";

// WebSocket Server Info
const char *websocket_server = "145.24.222.63"; // Replace with your server IP
const uint16_t websocket_port = 8080;
const char *websocket_path = "/";

WebSocketsClient webSocket;

#define SS_PIN 5
#define RST_PIN 0

MFRC522 rfid(SS_PIN, RST_PIN);
MFRC522::MIFARE_Key key;

bool cardScanned = false;
bool readyToScan = false; // Variable to check if scanning should be triggered

const byte ROWS = 4;
const byte COLS = 4;

char hexaKeys[ROWS][COLS] = {
    {'1', '2', '3', 'A'},
    {'4', '5', '6', 'B'},
    {'7', '8', '9', 'C'},
    {'*', '0', '#', 'D'}};

byte rowPins[ROWS] = {13, 12, 14, 27};
byte colPins[COLS] = {26, 25, 33, 32};

Keypad customKeypad = Keypad(makeKeymap(hexaKeys), rowPins, colPins, ROWS, COLS);
String trimBlock(String str) {
    int end = str.length() - 1;
    while (end >= 0 && (str.charAt(end) == '.' || str.charAt(end) == ' ')) {
        end--;
    }
    return str.substring(0, end + 1);
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length)
{
    switch (type)
    {
    case WStype_DISCONNECTED:
        Serial.println("WebSocket Disconnected!");
        break;
    case WStype_CONNECTED:
        Serial.println("WebSocket Connected!");
        webSocket.sendTXT("{\"type\": \"identity\", \"role\": \"esp\"}");
        break;
    case WStype_TEXT:
        Serial.printf("Message from Server: %s\n", payload);
        // Check if the server sends the scan trigger message
        if (strncmp((char *)payload, "{\"type\":\"scan\"}", length) == 0)
        {
            readyToScan = true; // Enable scanning
            Serial.println("Scan trigger received. Ready to scan card.");
        }
        break;
    default:
        break;
    }
}

String readBlockToString(byte block)
{
    MFRC522::StatusCode status;
    byte buffer[18];
    byte size = sizeof(buffer);

    status = rfid.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, block, &key, &(rfid.uid));
    if (status != MFRC522::STATUS_OK)
    {
        Serial.printf("Authentication failed for block %d: %s\n", block, rfid.GetStatusCodeName(status));
        return "";
    }

    status = rfid.MIFARE_Read(block, buffer, &size);
    if (status != MFRC522::STATUS_OK)
    {
        Serial.printf("Reading failed for block %d: %s\n", block, rfid.GetStatusCodeName(status));
        return "";
    }

    // Convert the raw bytes into a UTF-8 string (only printable ASCII)
    String result = "";
    for (int i = 0; i < 16; i++)
    {
        if (buffer[i] >= 32 && buffer[i] <= 126)
        {
            result += (char)buffer[i];
        }
        else
        {
            result += '.'; // non-printable replaced with dot for visibility
        }
    }
    return result;
}

void setup()
{
    Serial.begin(115200);
    SPI.begin();
    rfid.PCD_Init();

    // Set default key to 0xFF for all 6 bytes
    for (byte i = 0; i < 6; i++)
        key.keyByte[i] = 0xFF;

    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi...");
    while (WiFi.status() != WL_CONNECTED)
    {
        Serial.print(".");
        delay(500);
    }
    Serial.println("\nConnected to WiFi");

    webSocket.begin(websocket_server, websocket_port, websocket_path);
    webSocket.onEvent(webSocketEvent);
}

void loop()
{
    webSocket.loop();

    // Handle keypad inputs
    char customKey = customKeypad.getKey();
    if (customKey)
    {
        Serial.print("Key Pressed: ");
        Serial.println(customKey);
        String jsonMessage = "{\"type\": \"keypad\", \"value\": \"" + String(customKey) + "\"}";
        webSocket.sendTXT(jsonMessage);
    }

    // RFID scanning when triggered
    if (readyToScan && !cardScanned && rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial())
    {
        Serial.println("Card detected");

        String block1 = readBlockToString(1);
        String block2 = readBlockToString(2);
        String block4 = readBlockToString(4);

        if (block1.length() > 0 && block2.length() > 0 && block4.length() > 0) {
            String rekeningnummer = trimBlock(block1) + trimBlock(block2);
            String pasnummer = trimBlock(block4);
        
            Serial.print("Rekeningnummer: ");
            Serial.println(rekeningnummer);
            Serial.print("Pasnummer: ");
            Serial.println(pasnummer);
        
            String jsonMessage = "{\"type\": \"rfid\", \"rekeningnummer\": \"" + rekeningnummer + "\", \"pasnummer\": \"" + pasnummer + "\"}";
        
            if (webSocket.isConnected()) {
                Serial.print("Sending JSON: ");
                Serial.println(jsonMessage);
                webSocket.sendTXT(jsonMessage);
            } else {
                Serial.println("WebSocket not connected, message not sent");
            }
        }
        
        else
        {
            Serial.println("Failed to read one or more blocks.");
            if (block1.length() == 0)
                Serial.println("Block 1 empty or unreadable.");
            if (block2.length() == 0)
                Serial.println("Block 2 empty or unreadable.");
            if (block4.length() == 0)
                Serial.println("Block 4 empty or unreadable.");
        }

        rfid.PICC_HaltA();
        rfid.PCD_StopCrypto1();
        cardScanned = true;

        delay(3000); // debounce delay

        cardScanned = false;
        readyToScan = false;
    }
}
