# 🇷🇴 Learn Romanian - Flashcard App

A modern web application for learning Romanian using interactive flashcards, built with Flask (backend) and React (frontend).

## Features

- 📚 **Interactive Flashcards**: Study with Anki-style flashcards
- 🔄 **Bidirectional Learning**: English to Romanian and Romanian to English
- ➕ **Easy Card Management**: Add and remove cards with a simple interface
- 🎲 **Random Study Mode**: Get random cards for effective learning
- 🎨 **Modern UI**: Beautiful, responsive design with smooth animations
- 💾 **Persistent Storage**: MongoDB database to store your flashcards
- 🚀 **Easy Launch**: Run both services with a single script

## Project Structure

```
learn-romanian/
├── backend/
│   ├── app.py              # Flask API server
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── public/
│   │   └── index.html      # HTML template
│   ├── src/
│   │   ├── App.js          # Main React component
│   │   ├── index.js        # React entry point
│   │   └── index.css       # Styles
│   └── package.json        # Node.js dependencies
├── run_app.py              # Python launcher script
├── run_app.sh              # Unix/Linux launcher script
├── run_app.bat             # Windows launcher script
├── env_example.txt         # Environment variables example
└── README.md
```

## Setup Instructions

### Prerequisites

- Python 3.7+ 
- Node.js 14+
- npm or yarn
- MongoDB (running on localhost:27017)

### Quick Start (Recommended)

The easiest way to run the application is using one of the provided launcher scripts:

**For Windows:**
```cmd
run_app.bat
```

**For Unix/Linux/macOS:**
```bash
chmod +x run_app.sh
./run_app.sh
```

**Cross-platform Python script:**
```bash
python run_app.py
```

These scripts will automatically:
- Check prerequisites
- Install dependencies
- Start MongoDB connection check
- Launch both backend and frontend services
- Provide URLs to access the application

### Manual Setup (Alternative)

If you prefer to run services manually:

#### MongoDB Setup
1. Install MongoDB Community Edition from [mongodb.com](https://www.mongodb.com/try/download/community)
2. Start MongoDB:
```bash
mongod --dbpath /path/to/your/db
```

#### Environment Configuration
1. Copy the environment example file:
```bash
cp env_example.txt .env
```

2. Edit `.env` file to configure your MongoDB connection:
```bash
# For local MongoDB (default)
MONGO_URI=mongodb://localhost:27017/
DATABASE_NAME=romanian_flashcards

# For MongoDB Atlas (cloud)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/
DATABASE_NAME=romanian_flashcards

# For authenticated local MongoDB
MONGO_URI=mongodb://username:password@localhost:27017/
DATABASE_NAME=romanian_flashcards
```

#### Backend Setup
1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

4. Run the Flask server:
```bash
python app.py
```

The backend will start on `http://localhost:5000`

#### Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
```bash
cd frontend
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Start the React development server:
```bash
npm start
```

The frontend will start on `http://localhost:3000`

## Usage

### Study Mode
- Click "Get Random Card" to start studying
- Click on the flashcard to reveal the answer
- Use "Flip Direction" to switch between English→Romanian and Romanian→English
- The app randomly selects the direction for each new card

### Adding Cards
- Go to the "Add Cards" tab
- Enter English text and Romanian translation
- Click "Add Card" to save

### Managing Cards
- Go to the "Manage Cards" tab
- View all your flashcards
- Delete cards you no longer need

## API Endpoints

The Flask backend provides the following REST API endpoints:

- `GET /api/cards` - Get all flashcards
- `POST /api/cards` - Add a new flashcard
- `PUT /api/cards/<id>` - Update a flashcard
- `DELETE /api/cards/<id>` - Delete a flashcard
- `GET /api/cards/random` - Get a random flashcard

## Technologies Used

### Backend
- **Flask**: Web framework
- **PyMongo**: MongoDB driver for Python
- **Flask-CORS**: Cross-origin resource sharing
- **Python-dotenv**: Environment variable management
- **MongoDB**: NoSQL database for storing flashcards

### Frontend
- **React**: UI library
- **Axios**: HTTP client for API calls
- **Lucide React**: Icons
- **CSS3**: Modern styling with animations

## Sample Data

To get started quickly, you can add some sample Romanian flashcards:

| English | Romanian |
|---------|----------|
| Hello | Salut |
| Goodbye | La revedere |
| Thank you | Mulțumesc |
| Please | Te rog |
| Yes | Da |
| No | Nu |
| Good morning | Bună dimineața |
| Good evening | Bună seara |
| How are you? | Ce mai faci? |
| I love you | Te iubesc |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

If you encounter any issues or have suggestions for improvements, please create an issue in the repository.

---

Happy learning! 🎓 Baftă cu învățarea românei! 🇷🇴 