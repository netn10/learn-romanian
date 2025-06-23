from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
from dotenv import load_dotenv
import os
import re

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# MongoDB configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DATABASE_NAME = os.getenv("DATABASE_NAME", "romanian_flashcards")
COLLECTION_NAME = "cards"

# Initialize MongoDB client
client = MongoClient(MONGO_URI)
db = client[DATABASE_NAME]
cards_collection = db[COLLECTION_NAME]


def card_to_dict(card):
    """Convert MongoDB document to dictionary with string ID"""
    return {
        "id": str(card["_id"]),
        "english": card["english"],
        "romanian": card["romanian"],
        "created_at": (
            card["created_at"].isoformat()
            if isinstance(card["created_at"], datetime)
            else card["created_at"]
        ),
    }


def parse_bulk_cards(text):
    """Parse bulk card text and extract Romanian:English pairs"""
    cards = []
    lines = text.strip().split("\n")

    for line in lines:
        line = line.strip()

        # Skip empty lines
        if not line:
            continue

        # Skip section headers (lines that don't contain ':' or are in parentheses)
        if ":" not in line:
            continue

        # Skip lines that are just section titles (contain parentheses but no colon before them)
        if "(" in line and ")" in line and line.find(":") == -1:
            continue

        # Split on the first colon
        parts = line.split(":", 1)
        if len(parts) != 2:
            continue

        romanian = parts[0].strip()
        english = parts[1].strip()

        # Skip if either part is empty
        if not romanian or not english:
            continue

        # Remove any trailing punctuation that might interfere
        romanian = romanian.rstrip("!?.")
        english = english.rstrip("!?.")

        # Skip very short entries (likely parsing errors)
        if len(romanian) < 2 or len(english) < 2:
            continue

        # Check if Romanian side has comma-separated words
        if "," in romanian:
            # Create card for the full form (original)
            cards.append({"romanian": romanian, "english": english})

            # Create individual cards for each word
            romanian_words = [word.strip() for word in romanian.split(",")]
            for word in romanian_words:
                word = word.strip()
                if word and len(word) >= 2:  # Skip empty or very short words
                    cards.append({"romanian": word, "english": english})
        else:
            # Single word, create one card
            cards.append({"romanian": romanian, "english": english})

    return cards


# API Routes
@app.route("/api/cards/bulk", methods=["POST"])
def add_bulk_cards():
    """Add multiple flashcards from bulk text"""
    try:
        data = request.get_json()
        print(f"Received bulk import request: {data}")  # Debug log

        if not data or "text" not in data:
            return jsonify({"error": "Bulk text is required"}), 400

        # Parse the bulk text
        parsed_cards = parse_bulk_cards(data["text"])
        print(f"Parsed {len(parsed_cards)} cards")  # Debug log

        if not parsed_cards:
            return jsonify({"error": "No valid card pairs found in text"}), 400

        # Check for duplicates (optional - skip existing cards)
        skip_duplicates = data.get("skip_duplicates", True)
        added_cards = []
        skipped_count = 0

        for i, card_data in enumerate(parsed_cards):
            try:
                print(f"Processing card {i+1}: {card_data}")  # Debug log

                if skip_duplicates:
                    # Check if card already exists (same Romanian text)
                    existing = cards_collection.find_one(
                        {"romanian": card_data["romanian"]}
                    )
                    if existing:
                        print(
                            f"Skipping duplicate: {card_data['romanian']}"
                        )  # Debug log
                        skipped_count += 1
                        continue

                # Add the card
                card = {
                    "english": card_data["english"],
                    "romanian": card_data["romanian"],
                    "created_at": datetime.utcnow(),
                }

                result = cards_collection.insert_one(card)
                card["_id"] = result.inserted_id
                added_cards.append(card_to_dict(card))
                print(
                    f"Added card: {card_data['romanian']} -> {card_data['english']}"
                )  # Debug log

            except Exception as card_error:
                print(
                    f"Error processing individual card {i+1}: {card_error}"
                )  # Debug log
                # Continue with other cards instead of failing completely
                continue

        print(
            f"Import complete: {len(added_cards)} added, {skipped_count} skipped"
        )  # Debug log

        return (
            jsonify(
                {
                    "message": f"Successfully added {len(added_cards)} cards",
                    "added_count": len(added_cards),
                    "skipped_count": skipped_count,
                    "total_parsed": len(parsed_cards),
                    "added_cards": added_cards,
                }
            ),
            201,
        )

    except Exception as e:
        print(f"Bulk import error: {str(e)}")  # Debug log
        print(f"Error type: {type(e)}")  # Debug log
        import traceback

        traceback.print_exc()  # Full stack trace
        return jsonify({"error": f"Import failed: {str(e)}"}), 500


@app.route("/api/cards", methods=["GET"])
def get_cards():
    """Get all flashcards"""
    try:
        cards = list(cards_collection.find().sort("created_at", -1))
        return jsonify([card_to_dict(card) for card in cards])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/cards", methods=["POST"])
def add_card():
    """Add a new flashcard"""
    try:
        data = request.get_json()

        if not data or "english" not in data or "romanian" not in data:
            return jsonify({"error": "English and Romanian text are required"}), 400

        card = {
            "english": data["english"].strip(),
            "romanian": data["romanian"].strip(),
            "created_at": datetime.utcnow(),
        }

        result = cards_collection.insert_one(card)
        card["_id"] = result.inserted_id

        return jsonify(card_to_dict(card)), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/cards/<card_id>", methods=["DELETE"])
def delete_card(card_id):
    """Delete a flashcard"""
    try:
        if not ObjectId.is_valid(card_id):
            return jsonify({"error": "Invalid card ID"}), 400

        result = cards_collection.delete_one({"_id": ObjectId(card_id)})

        if result.deleted_count == 0:
            return jsonify({"error": "Card not found"}), 404

        return jsonify({"message": "Card deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/cards/<card_id>", methods=["PUT"])
def update_card(card_id):
    """Update a flashcard"""
    try:
        if not ObjectId.is_valid(card_id):
            return jsonify({"error": "Invalid card ID"}), 400

        data = request.get_json()

        if not data:
            return jsonify({"error": "No data provided"}), 400

        update_data = {}
        if "english" in data:
            update_data["english"] = data["english"].strip()
        if "romanian" in data:
            update_data["romanian"] = data["romanian"].strip()

        if not update_data:
            return jsonify({"error": "No valid fields to update"}), 400

        result = cards_collection.update_one(
            {"_id": ObjectId(card_id)}, {"$set": update_data}
        )

        if result.matched_count == 0:
            return jsonify({"error": "Card not found"}), 404

        updated_card = cards_collection.find_one({"_id": ObjectId(card_id)})
        return jsonify(card_to_dict(updated_card))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/cards/random", methods=["GET"])
def get_random_card():
    """Get a random flashcard for studying"""
    try:
        # Use MongoDB's aggregation pipeline to get a random document
        pipeline = [{"$sample": {"size": 1}}]
        cards = list(cards_collection.aggregate(pipeline))

        if not cards:
            return jsonify({"error": "No cards available"}), 404

        return jsonify(card_to_dict(cards[0]))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    try:
        # Test MongoDB connection
        client.admin.command("ping")
        return jsonify(
            {
                "status": "healthy",
                "database": "connected",
                "mongo_uri": (
                    MONGO_URI.replace(
                        MONGO_URI.split("@")[0].split("//")[1] + "@", "***:***@"
                    )
                    if "@" in MONGO_URI
                    else MONGO_URI
                ),
                "database_name": DATABASE_NAME,
            }
        )
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500


if __name__ == "__main__":
    print("Starting Romanian Flashcards API...")
    print(
        f"MongoDB URI: {MONGO_URI.replace(MONGO_URI.split('@')[0].split('//')[1] + '@', '***:***@') if '@' in MONGO_URI else MONGO_URI}"
    )
    print(f"Database: {DATABASE_NAME}")
    print("Server running on http://localhost:5000")
    app.run(debug=True, port=5000)
