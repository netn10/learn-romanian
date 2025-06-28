from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
from dotenv import load_dotenv
import os
import re
import json
import time

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
        "tags": card.get("tags", []),  # Default to empty list for older cards
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

    def is_separating_comma(romanian_text):
        """
        Determine if commas in the Romanian text are separating different words/phrases
        or are part of the actual phrase (like in sentences or greetings).

        Separating commas typically appear in vocabulary lists like:
        - "doamnă, doamne: madam / lady"
        - "domn, domni: sir / mister"

        Non-separating commas appear in phrases/sentences like:
        - "Bună dimineața, doamnă!: Good morning, madam!"
        - "Bine, mulțumesc: Fine, thank you"
        """
        # If the text contains sentence punctuation (! ? .), treat commas as part of the phrase
        if any(punct in romanian_text for punct in ["!", "?", "."]):
            return False

        # If the text has multiple words AND common greeting/phrase patterns, likely a sentence
        words = romanian_text.strip().split()
        if len(words) > 2:  # More than 2 words usually indicates a phrase/sentence
            return False

        # Check for common Romanian greeting/phrase patterns that shouldn't be split
        phrase_patterns = [
            "bună dimineața",
            "bună ziua",
            "bună seara",
            "la revedere",
            "ce mai",
            "și eu",
            "bine ați",
            "mulțumesc",
            "și tu",
            "bună,",  # Greetings with names
            "salut,",  # Greetings with names
        ]

        text_lower = romanian_text.lower()
        for pattern in phrase_patterns:
            if pattern in text_lower:
                return False

        # If we have exactly 2 words separated by comma, likely vocabulary variants
        comma_parts = [part.strip() for part in romanian_text.split(",")]
        if len(comma_parts) == 2:
            # Check if second part starts with capital letter (likely a name)
            if comma_parts[1] and comma_parts[1][0].isupper():
                return False  # Likely "Greeting, Name" format

            # Both parts should be relatively short (single words or short phrases)
            # and both should be lowercase words (not names)
            if all(len(part.split()) <= 2 for part in comma_parts):
                # Additional check: if either part contains multiple words, less likely to be vocabulary variants
                if any(len(part.split()) > 1 for part in comma_parts):
                    return False
                return True

        # For lists of 3+ comma-separated items that are all short, likely vocabulary
        if len(comma_parts) >= 3:
            if all(len(part.split()) == 1 for part in comma_parts):  # All single words
                return True

        # Default: treat commas as part of phrase
        return False

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

        # Store original for potential restoration
        original_romanian = romanian
        original_english = english

        # Remove any trailing punctuation that might interfere with parsing
        romanian = romanian.rstrip("!?.")
        english = english.rstrip("!?.")

        # Skip very short entries (likely parsing errors)
        if len(romanian) < 2 or len(english) < 2:
            continue

        # Extract tags from English text if present (format: "text [tag1, tag2]")
        tags = []
        if "[" in english and "]" in english:
            # Extract tags from square brackets
            tag_start = english.rfind("[")
            tag_end = english.rfind("]")
            if tag_start < tag_end:
                tag_text = english[tag_start + 1 : tag_end]
                tags = [
                    tag.strip().lower() for tag in tag_text.split(",") if tag.strip()
                ]
                # Remove tags from English text
                english = english[:tag_start].strip()
                original_english = english

        # Handle slashes as alternative forms (takes priority over comma handling)
        if "/" in romanian:
            # Create card for the full form (original with punctuation restored)
            cards.append(
                {
                    "romanian": original_romanian,
                    "english": original_english,
                    "tags": tags,
                }
            )

            # Create individual cards for each alternative form
            alternatives = [alt.strip() for alt in original_romanian.split("/")]
            for alt in alternatives:
                alt = alt.strip()
                if alt and len(alt) >= 2:  # Skip empty or very short alternatives
                    cards.append(
                        {"romanian": alt, "english": original_english, "tags": tags}
                    )
        # Check if Romanian side has comma-separated vocabulary items vs phrases with commas
        elif "," in romanian and is_separating_comma(romanian):
            # Create card for the full form (original with punctuation restored)
            cards.append(
                {
                    "romanian": original_romanian,
                    "english": original_english,
                    "tags": tags,
                }
            )

            # Create individual cards for each vocabulary word/phrase
            romanian_words = [word.strip() for word in romanian.split(",")]
            for word in romanian_words:
                word = word.strip()
                if word and len(word) >= 2:  # Skip empty or very short words
                    cards.append(
                        {"romanian": word, "english": original_english, "tags": tags}
                    )
        else:
            # Single phrase/sentence or phrase with non-separating commas - keep as one card
            cards.append(
                {
                    "romanian": original_romanian,
                    "english": original_english,
                    "tags": tags,
                }
            )

    return cards


# API Routes
@app.route("/api/cards/bulk/progress", methods=["POST"])
def add_bulk_cards_with_progress():
    """Add multiple flashcards from bulk text with progress tracking"""
    try:
        data = request.get_json()
        print(f"Received bulk import request with progress: {data}")  # Debug log

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
        total_cards = len(parsed_cards)

        def generate_progress():
            """Generator function for progress updates"""
            nonlocal added_cards, skipped_count

            # Send initial progress
            yield f"data: {json.dumps({'type': 'progress', 'current': 0, 'total': total_cards, 'percentage': 0, 'status': 'Starting import...'})}\n\n"

            batch_size = max(
                1, total_cards // 20
            )  # Process in batches for smooth progress

            for i, card_data in enumerate(parsed_cards):
                try:
                    if skip_duplicates:
                        # Check if card already exists (same Romanian text)
                        existing = cards_collection.find_one(
                            {"romanian": card_data["romanian"]}
                        )
                        if existing:
                            skipped_count += 1
                            continue

                    # Add the card
                    card = {
                        "english": card_data["english"],
                        "romanian": card_data["romanian"],
                        "tags": card_data.get("tags", []),
                        "created_at": datetime.utcnow(),
                    }

                    result = cards_collection.insert_one(card)
                    card["_id"] = result.inserted_id
                    added_cards.append(card_to_dict(card))

                except Exception as card_error:
                    print(f"Error processing individual card {i+1}: {card_error}")
                    continue

                # Send progress update
                current = i + 1
                percentage = int((current / total_cards) * 100)
                status = f"Processing card {current}/{total_cards} - {card_data['romanian'][:30]}..."

                yield f"data: {json.dumps({'type': 'progress', 'current': current, 'total': total_cards, 'percentage': percentage, 'status': status})}\n\n"

                # Small delay to make progress visible
                if i % batch_size == 0:
                    time.sleep(0.05)

            # Send completion message
            final_message = (
                f"Import complete: {len(added_cards)} added, {skipped_count} skipped"
            )
            yield f"data: {json.dumps({'type': 'complete', 'added_count': len(added_cards), 'skipped_count': skipped_count, 'total_parsed': total_cards, 'message': final_message})}\n\n"

        return Response(
            generate_progress(),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        )

    except Exception as e:
        print(f"Bulk import error: {str(e)}")
        return jsonify({"error": f"Import failed: {str(e)}"}), 500


@app.route("/api/cards/bulk", methods=["POST"])
def add_bulk_cards():
    """Add multiple flashcards from bulk text (legacy endpoint)"""
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
                    "tags": card_data.get("tags", []),
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

        print(f"Import complete: {len(added_cards)} added, {skipped_count} skipped")

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
    """Get flashcards with optional pagination, sorting, and search"""
    try:
        # Get query parameters
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 10))
        sort_by = request.args.get("sort_by", "created_at")
        sort_order = request.args.get("sort_order", "desc")
        search = request.args.get("search", "").strip()

        # Validate parameters
        page = max(1, page)
        limit = min(100, max(1, limit))  # Cap at 100 items per page

        # Valid sort fields
        valid_sort_fields = ["created_at", "english", "romanian"]
        if sort_by not in valid_sort_fields:
            sort_by = "created_at"

        # Sort order
        sort_direction = -1 if sort_order.lower() == "desc" else 1

        # Build query
        query = {}
        if search:
            # Case-insensitive search in english, romanian, and tags fields
            query = {
                "$or": [
                    {"english": {"$regex": search, "$options": "i"}},
                    {"romanian": {"$regex": search, "$options": "i"}},
                    {"tags": {"$regex": search, "$options": "i"}},
                ]
            }

        # Get total count for pagination
        total_count = cards_collection.count_documents(query)

        # Calculate pagination
        skip = (page - 1) * limit
        total_pages = (total_count + limit - 1) // limit

        # Get cards with pagination and sorting
        cards = list(
            cards_collection.find(query)
            .sort(sort_by, sort_direction)
            .skip(skip)
            .limit(limit)
        )

        # Return paginated response
        return jsonify(
            {
                "cards": [card_to_dict(card) for card in cards],
                "pagination": {
                    "current_page": page,
                    "total_pages": total_pages,
                    "total_count": total_count,
                    "page_size": limit,
                    "has_next": page < total_pages,
                    "has_prev": page > 1,
                },
                "filters": {
                    "search": search,
                    "sort_by": sort_by,
                    "sort_order": sort_order,
                },
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/cards/all", methods=["GET"])
def get_all_cards():
    """Get all flashcards (for study mode)"""
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

        # Process tags - ensure they're cleaned and unique
        tags = []
        if "tags" in data and data["tags"]:
            if isinstance(data["tags"], list):
                tags = [tag.strip().lower() for tag in data["tags"] if tag.strip()]
            elif isinstance(data["tags"], str):
                # Handle comma-separated tags from text input
                tags = [
                    tag.strip().lower()
                    for tag in data["tags"].split(",")
                    if tag.strip()
                ]
            # Remove duplicates while preserving order
            tags = list(dict.fromkeys(tags))

        card = {
            "english": data["english"].strip(),
            "romanian": data["romanian"].strip(),
            "tags": tags,
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
        if "tags" in data:
            # Process tags - ensure they're cleaned and unique
            tags = []
            if data["tags"]:
                if isinstance(data["tags"], list):
                    tags = [tag.strip().lower() for tag in data["tags"] if tag.strip()]
                elif isinstance(data["tags"], str):
                    # Handle comma-separated tags from text input
                    tags = [
                        tag.strip().lower()
                        for tag in data["tags"].split(",")
                        if tag.strip()
                    ]
                # Remove duplicates while preserving order
                tags = list(dict.fromkeys(tags))
            update_data["tags"] = tags

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


@app.route("/api/tags", methods=["GET"])
def get_all_tags():
    """Get all unique tags from flashcards"""
    try:
        # Use MongoDB aggregation to get all unique tags
        pipeline = [
            {"$unwind": "$tags"},  # Separate array elements into individual documents
            {"$group": {"_id": "$tags"}},  # Group by tag to get unique values
            {"$sort": {"_id": 1}},  # Sort alphabetically
            {"$project": {"tag": "$_id", "_id": 0}},  # Rename field and exclude _id
        ]

        result = list(cards_collection.aggregate(pipeline))
        tags = [item["tag"] for item in result]

        return jsonify({"tags": tags})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/cards/by-tag/<tag>", methods=["GET"])
def get_cards_by_tag(tag):
    """Get flashcards that have a specific tag"""
    try:
        # Case-insensitive tag search
        cards = list(
            cards_collection.find({"tags": {"$regex": f"^{tag}$", "$options": "i"}})
        )
        return jsonify([card_to_dict(card) for card in cards])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/cards/filter", methods=["GET"])
def filter_cards():
    """Filter cards by multiple criteria including tags"""
    try:
        tags = request.args.getlist("tags")  # Get multiple tag parameters
        search = request.args.get("search", "").strip()

        query = {}
        conditions = []

        # Tag filtering
        if tags:
            # Match cards that have ANY of the specified tags (OR condition)
            tag_conditions = [
                {"tags": {"$regex": f"^{tag}$", "$options": "i"}} for tag in tags
            ]
            conditions.append({"$or": tag_conditions})

        # Text search
        if search:
            conditions.append(
                {
                    "$or": [
                        {"english": {"$regex": search, "$options": "i"}},
                        {"romanian": {"$regex": search, "$options": "i"}},
                    ]
                }
            )

        # Combine conditions with AND
        if conditions:
            query = {"$and": conditions} if len(conditions) > 1 else conditions[0]

        cards = list(cards_collection.find(query).sort("created_at", -1))
        return jsonify([card_to_dict(card) for card in cards])
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
