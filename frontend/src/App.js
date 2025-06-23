import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Shuffle, Plus, BookOpen, List, RotateCcw, Trash2, Upload, FileText, Clock, Play, Pause, SkipForward, Volume2, Moon, Sun } from 'lucide-react';
import './index.css';

const API_BASE_URL = 'http://localhost:5000/api';

function App() {
  const [activeTab, setActiveTab] = useState('study');
  const [cards, setCards] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false); // true = Romanian to English, false = English to Romanian
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Timer mode state
  const [timerMode, setTimerMode] = useState(false);
  const [timerDuration, setTimerDuration] = useState(5); // seconds
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerInterval, setTimerInterval] = useState(null);
  const [allowClickInTimer, setAllowClickInTimer] = useState(true); // Allow clicking in timer mode

  // Text-to-speech state
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  // Shuffled deck mode state
  const [shuffledDeckMode, setShuffledDeckMode] = useState(false);
  const [remainingCards, setRemainingCards] = useState([]);
  const [completedCards, setCompletedCards] = useState([]);
  const [deckProgress, setDeckProgress] = useState(0);

  // Form state
  const [newCard, setNewCard] = useState({ english: '', romanian: '' });
  
  // Bulk import state
  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  useEffect(() => {
    fetchCards();
  }, []);

  // Dark mode effect
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Initialize shuffled deck when cards are loaded or shuffled mode is enabled
  useEffect(() => {
    if (shuffledDeckMode && cards.length > 0) {
      initializeShuffledDeck();
    }
  }, [shuffledDeckMode, cards]);

  // Timer effect
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setShowAnswer(true);
            setTimerActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setTimerInterval(interval);
      return () => clearInterval(interval);
    } else if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  }, [timerActive, timeLeft]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      // Stop ResponsiveVoice if available
      if (window.responsiveVoice) {
        window.responsiveVoice.cancel();
      }
      // Stop Web Speech API
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
      // Clean up any remaining audio elements
      const existingAudio = document.querySelector('#tts-audio');
      if (existingAudio) {
        existingAudio.pause();
        existingAudio.remove();
      }
    };
  }, []);

  const fetchCards = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/cards`);
      setCards(response.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch cards');
      console.error('Error fetching cards:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRandomCard = async () => {
    // If shuffled deck mode is enabled and there are remaining cards, use deck
    if (shuffledDeckMode && remainingCards.length > 0) {
      getShuffledCard();
      return;
    }
    
    try {
      setLoading(true);
      
      // Stop any ongoing audio
      if (window.responsiveVoice) {
        window.responsiveVoice.cancel();
      }
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
      const existingAudio = document.querySelector('#tts-audio');
      if (existingAudio) {
        existingAudio.pause();
        existingAudio.remove();
      }
      setSpeaking(false);
      
      const response = await axios.get(`${API_BASE_URL}/cards/random`);
      setCurrentCard(response.data);
      setShowAnswer(false);
      setIsFlipped(Math.random() > 0.5); // Randomly decide direction
      setError('');
      
      // Reset timer state
      setTimerActive(false);
      setTimeLeft(0);
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
    } catch (err) {
      setError('Failed to get random card');
      console.error('Error getting random card:', err);
    } finally {
      setLoading(false);
    }
  };

  const startTimer = () => {
    if (currentCard && timerMode) {
      setShowAnswer(false);
      setTimeLeft(timerDuration);
      setTimerActive(true);
    }
  };

  const pauseTimer = () => {
    setTimerActive(false);
  };

  const skipTimer = () => {
    setTimerActive(false);
    setTimeLeft(0);
    setShowAnswer(true);
  };

  const resetTimer = () => {
    setTimerActive(false);
    setTimeLeft(0);
    setShowAnswer(false);
  };

  const nextCard = async () => {
    if (shuffledDeckMode) {
      getShuffledCard();
    } else {
      await getRandomCard();
    }
    
    if (timerMode) {
      // Small delay to ensure state is updated
      setTimeout(() => {
        startTimer();
      }, 100);
    }
  };

  // Initialize shuffled deck
  const initializeShuffledDeck = () => {
    if (cards.length === 0) return;
    
    // Shuffle all cards
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setRemainingCards(shuffled);
    setCompletedCards([]);
    setDeckProgress(0);
    setCurrentCard(null);
    setShowAnswer(false);
  };

  // Get next card from shuffled deck
  const getShuffledCard = () => {
    if (remainingCards.length === 0) {
      if (completedCards.length > 0) {
        // Deck completed, offer to restart
        setSuccess(`Deck completed! You've studied all ${completedCards.length} cards. Starting a new shuffled deck...`);
        setTimeout(() => setSuccess(''), 3000);
        initializeShuffledDeck();
        return;
      } else {
        setError('No cards available in deck');
        return;
      }
    }

    // Pick the next card from the deck
    const nextCard = remainingCards[0];
    const newRemainingCards = remainingCards.slice(1);
    const newCompletedCards = [...completedCards, nextCard];
    
    setRemainingCards(newRemainingCards);
    setCompletedCards(newCompletedCards);
    setCurrentCard(nextCard);
    setShowAnswer(false);
    setIsFlipped(Math.random() > 0.5);
    
    // Update progress
    const progress = Math.round((newCompletedCards.length / cards.length) * 100);
    setDeckProgress(progress);

    // Reset timer state
    setTimerActive(false);
    setTimeLeft(0);
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }

    // Stop any ongoing audio
    if (window.responsiveVoice) {
      window.responsiveVoice.cancel();
    }
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    const existingAudio = document.querySelector('#tts-audio');
    if (existingAudio) {
      existingAudio.pause();
      existingAudio.remove();
    }
    setSpeaking(false);
  };

  const speakText = (text, language) => {
    if (!ttsEnabled) {
      console.warn('Text-to-speech disabled');
      return;
    }

    // Stop any current audio
    const existingAudio = document.querySelector('#tts-audio');
    if (existingAudio) {
      existingAudio.pause();
      existingAudio.remove();
    }

    setSpeaking(true);

    // Check if ResponsiveVoice is available
    if (window.responsiveVoice) {
      console.log('Using ResponsiveVoice for TTS');
      const voiceName = language === 'romanian' ? 'Romanian Female' : 'US English Female';
      
      window.responsiveVoice.speak(text, voiceName, {
        rate: language === 'romanian' ? 0.8 : 0.9,
        pitch: 1,
        volume: 1,
        onstart: () => setSpeaking(true),
        onend: () => setSpeaking(false),
        onerror: (e) => {
          console.error('ResponsiveVoice error:', e);
          setSpeaking(false);
          // Fallback to Web Speech API
          fallbackToWebSpeech(text, language);
        }
      });
    } else {
      console.log('ResponsiveVoice not available, using Web Speech API');
      // Fallback to Web Speech API with improved settings
      fallbackToWebSpeech(text, language);
    }
  };

  const fallbackToWebSpeech = (text, language) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      setSpeaking(false);
      setError('Text-to-speech not supported in this browser.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Stop any current speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set language and improved settings
    if (language === 'romanian') {
      utterance.lang = 'ro-RO';
      utterance.rate = 0.7; // Slower for Romanian
      utterance.pitch = 0.9;
    } else {
      utterance.lang = 'en-US';
      utterance.rate = 0.8;
      utterance.pitch = 1;
    }
    
    utterance.volume = 1;

    // Handle speech events
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = (e) => {
      console.error('Speech synthesis error:', e);
      setSpeaking(false);
      setError('Text-to-speech failed. Please try again.');
      setTimeout(() => setError(''), 3000);
    };

    speechSynthesis.speak(utterance);
  };

  const speakRomanian = () => {
    if (currentCard) {
      speakText(currentCard.romanian, 'romanian');
    }
  };

  const speakEnglish = () => {
    if (currentCard) {
      speakText(currentCard.english, 'english');
    }
  };

  const addCard = async (e) => {
    e.preventDefault();
    if (!newCard.english.trim() || !newCard.romanian.trim()) {
      setError('Both English and Romanian text are required');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/cards`, newCard);
      setNewCard({ english: '', romanian: '' });
      setSuccess('Card added successfully!');
      setError('');
      await fetchCards();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to add card');
      console.error('Error adding card:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteCard = async (cardId) => {
    if (!window.confirm('Are you sure you want to delete this card?')) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`${API_BASE_URL}/cards/${cardId}`);
      setSuccess('Card deleted successfully!');
      setError('');
      await fetchCards();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to delete card');
      console.error('Error deleting card:', err);
    } finally {
      setLoading(false);
    }
  };

  const parseBulkText = (text) => {
    const cards = [];
    const lines = text.trim().split('\n');
    
    for (let line of lines) {
      line = line.trim();
      
      // Skip empty lines
      if (!line) continue;
      
      // Skip section headers
      if (!line.includes(':')) continue;
      
      // Skip lines that are just section titles
      if (line.includes('(') && line.includes(')') && line.indexOf(':') === -1) continue;
      
      // Split on the first colon
      const parts = line.split(':', 2);
      if (parts.length !== 2) continue;
      
      let romanian = parts[0].trim();
      let english = parts[1].trim();
      
      // Skip if either part is empty or too short
      if (!romanian || !english || romanian.length < 2 || english.length < 2) continue;
      
      // Remove trailing punctuation
      romanian = romanian.replace(/[!?.]+$/, '');
      english = english.replace(/[!?.]+$/, '');
      
      // Check if Romanian side has comma-separated words
      if (romanian.includes(',')) {
        // Create card for the full form (original)
        cards.push({
          romanian: romanian,
          english: english
        });
        
        // Create individual cards for each word
        const romanianWords = romanian.split(',').map(word => word.trim());
        for (let word of romanianWords) {
          word = word.trim();
          if (word && word.length >= 2) { // Skip empty or very short words
            cards.push({
              romanian: word,
              english: english
            });
          }
        }
      } else {
        // Single word, create one card
        cards.push({
          romanian: romanian,
          english: english
        });
      }
    }
    
    return cards;
  };

  const previewBulkCards = () => {
    if (!bulkText.trim()) {
      setError('Please enter some text to preview');
      return;
    }
    
    const preview = parseBulkText(bulkText);
    setBulkPreview(preview);
    setShowPreview(true);
    setError('');
    
    if (preview.length === 0) {
      setError('No valid card pairs found. Make sure your text follows the format: "romanian: english"');
    }
  };

  const addBulkCards = async () => {
    if (!bulkText.trim()) {
      setError('Please enter some text to import');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/cards/bulk`, {
        text: bulkText,
        skip_duplicates: skipDuplicates
      });
      
      const { added_count, skipped_count, total_parsed } = response.data;
      
      setBulkText('');
      setBulkPreview([]);
      setShowPreview(false);
      
      let message = `Successfully imported ${added_count} cards`;
      if (skipped_count > 0) {
        message += ` (${skipped_count} duplicates skipped)`;
      }
      message += ` out of ${total_parsed} parsed entries.`;
      
      setSuccess(message);
      setError('');
      await fetchCards();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to import cards');
      console.error('Error importing bulk cards:', err);
    } finally {
      setLoading(false);
    }
  };

  const StudyTab = () => (
    <div className="card">
      {/* Game Options */}
      <div className="study-controls">
        <div className="study-controls-row">
          <label className="study-control-item">
            <input
              type="checkbox"
              checked={timerMode}
              onChange={(e) => {
                setTimerMode(e.target.checked);
                if (!e.target.checked) {
                  setTimerActive(false);
                  setTimeLeft(0);
                  setShowAnswer(false);
                }
              }}
            />
            <Clock size={16} />
            Timer Mode
          </label>
          
          <label className="study-control-item">
            <input
              type="checkbox"
              checked={ttsEnabled}
              onChange={(e) => {
                setTtsEnabled(e.target.checked);
                if (!e.target.checked && speaking) {
                  if (window.responsiveVoice) {
                    window.responsiveVoice.cancel();
                  }
                  if ('speechSynthesis' in window) {
                    speechSynthesis.cancel();
                  }
                  const existingAudio = document.querySelector('#tts-audio');
                  if (existingAudio) {
                    existingAudio.pause();
                    existingAudio.remove();
                  }
                  setSpeaking(false);
                }
              }}
            />
            <Volume2 size={16} />
            Advanced Text-to-Speech
          </label>
          
          <label className="study-control-item">
            <input
              type="checkbox"
              checked={shuffledDeckMode}
              onChange={(e) => {
                setShuffledDeckMode(e.target.checked);
                if (!e.target.checked) {
                  // Reset shuffled deck state when disabling
                  setRemainingCards([]);
                  setCompletedCards([]);
                  setDeckProgress(0);
                }
              }}
            />
            <Shuffle size={16} />
            Shuffled Deck Mode
          </label>
        </div>
        
        {/* Shuffled Deck Progress */}
        {shuffledDeckMode && cards.length > 0 && (
          <div className="deck-progress">
            <div className="deck-progress-header">
              <span className="deck-progress-title">
                📚 Deck Progress: {completedCards.length} / {cards.length} cards
              </span>
              <span className="deck-progress-percent">
                {deckProgress}% complete
              </span>
            </div>
            <div className="deck-progress-bar">
              <div 
                className="deck-progress-fill"
                style={{ width: `${deckProgress}%` }}
              ></div>
            </div>
            {remainingCards.length === 0 && completedCards.length > 0 && (
              <div className="deck-completed">
                🎉 Deck completed! Click "Next Card" to start a new shuffled deck.
              </div>
            )}
          </div>
        )}
        
        {timerMode && (
          <div className="study-control-item" style={{ paddingLeft: '15px', paddingBottom: '10px' }}>
            <label htmlFor="timerDuration">Duration:</label>
            <select
              id="timerDuration"
              value={timerDuration}
              onChange={(e) => setTimerDuration(Number(e.target.value))}
              disabled={timerActive}
            >
              <option value={3}>3 seconds</option>
              <option value={5}>5 seconds</option>
              <option value={7}>7 seconds</option>
              <option value={10}>10 seconds</option>
              <option value={15}>15 seconds</option>
              <option value={20}>20 seconds</option>
            </select>
          </div>
        )}
        
        {timerMode && (
          <div className="study-control-item" style={{ paddingLeft: '15px', paddingBottom: '10px' }}>
            <label>
              <input
                type="checkbox"
                checked={allowClickInTimer}
                onChange={(e) => setAllowClickInTimer(e.target.checked)}
              />
              Allow clicking to reveal answer early
            </label>
          </div>
        )}
      
        {timerMode && currentCard && (
          <div className="timer-game-controls" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {!timerActive && timeLeft === 0 ? (
              <button className="btn btn-success" onClick={startTimer}>
                <Play size={16} />
                Start Timer
              </button>
            ) : (
              <>
                {timerActive ? (
                  <button className="btn btn-warning" onClick={pauseTimer}>
                    <Pause size={16} />
                    Pause
                  </button>
                ) : (
                  <button className="btn btn-success" onClick={() => setTimerActive(true)}>
                    <Play size={16} />
                    Resume
                  </button>
                )}
                
                <button className="btn btn-secondary" onClick={skipTimer}>
                  <SkipForward size={16} />
                  Skip
                </button>
                
                <button className="btn btn-secondary" onClick={resetTimer}>
                  Reset
                </button>
                
                <button className="btn" onClick={nextCard} disabled={loading}>
                  <Shuffle size={16} />
                  Next Card
                </button>
              </>
            )}
            
            {timeLeft > 0 && (
              <div 
                className="timer-display" 
                style={{ 
                  marginLeft: '10px',
                  color: timeLeft <= 3 ? '#e74c3c' : '#2ecc71'
                }}
              >
                {timeLeft}s
              </div>
            )}
          </div>
        )}
      </div>

      {currentCard ? (
        <div 
          className="flashcard" 
          onClick={() => {
            if (allowClickInTimer || !timerMode) {
              if (timerMode && timerActive && !showAnswer) {
                // Stop timer when clicking early
                setTimerActive(false);
                setTimeLeft(0);
              }
              setShowAnswer(!showAnswer);
            }
          }}
          style={{ 
            cursor: (allowClickInTimer || !timerMode) ? 'pointer' : 'default'
          }}
        >
          <div className="flashcard-text">
            {showAnswer 
              ? (isFlipped ? currentCard.english : currentCard.romanian)
              : (isFlipped ? currentCard.romanian : currentCard.english)
            }
          </div>
          
          {/* Text-to-Speech Controls */}
          {ttsEnabled && currentCard && (
            <div className="tts-controls" style={{ justifyContent: 'center' }}>
              {!showAnswer ? (
                // Show speaker for the visible side
                <button 
                  className="btn btn-secondary btn-small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isFlipped) {
                      speakRomanian();
                    } else {
                      speakEnglish();
                    }
                  }}
                  disabled={speaking}
                  title={`Listen to ${isFlipped ? 'Romanian' : 'English'}`}
                >
                  <Volume2 size={16} />
                  {speaking ? 'Playing...' : (isFlipped ? 'RO Listen' : 'EN Listen')}
                </button>
              ) : (
                // Show both speakers when answer is revealed
                <>
                  <button 
                    className="btn btn-secondary btn-small" 
                    onClick={(e) => {
                      e.stopPropagation();
                      speakRomanian();
                    }}
                    disabled={speaking}
                    title="Listen to Romanian"
                  >
                    <Volume2 size={16} />
                    {speaking ? 'Playing...' : 'Romanian'}
                  </button>
                  <button 
                    className="btn btn-secondary btn-small" 
                    onClick={(e) => {
                      e.stopPropagation();
                      speakEnglish();
                    }}
                    disabled={speaking}
                    title="Listen to English"
                  >
                    <Volume2 size={16} />
                    {speaking ? 'Playing...' : 'English'}
                  </button>
                </>
              )}
            </div>
          )}
          
          {!showAnswer && (
            <div className="flashcard-hint">
              {timerMode 
                ? `${isFlipped ? 'English' : 'Romanian'} translation will appear automatically${allowClickInTimer ? ' (or click to reveal early)' : ''}`
                : `Click to reveal ${isFlipped ? 'English' : 'Romanian'} translation`
              }
            </div>
          )}
          {showAnswer && (
            <div className="flashcard-hint">
              {isFlipped ? 'English' : 'Romanian'} translation
            </div>
          )}
        </div>
      ) : (
        <div className="flashcard">
          <div className="flashcard-text">
            Click "Get Random Card" to start studying!
          </div>
        </div>
      )}
      
      {!timerMode && (
        <div className="flashcard-controls">
          {shuffledDeckMode ? (
            <>
              <button 
                className="btn" 
                onClick={getShuffledCard} 
                disabled={loading || (remainingCards.length === 0 && completedCards.length === 0)}
              >
                <Shuffle size={20} />
                {remainingCards.length === 0 && completedCards.length > 0 ? 'Start New Deck' : 'Next Card'}
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={initializeShuffledDeck}
                disabled={loading || cards.length === 0}
              >
                <RotateCcw size={20} />
                Reshuffle Deck
              </button>
            </>
          ) : (
            <button className="btn" onClick={getRandomCard} disabled={loading}>
              <Shuffle size={20} />
              Get Random Card
            </button>
          )}
          
          <button className="btn btn-secondary" onClick={() => setIsFlipped(!isFlipped)}>
            <RotateCcw size={20} />
            Flip Direction
          </button>
          
          {currentCard && (
            <button className="btn btn-secondary" onClick={() => setShowAnswer(!showAnswer)}>
              {showAnswer ? 'Hide' : 'Show'} Answer
            </button>
          )}
        </div>
      )}
      
      {currentCard && (
        <div className="study-mode-info">
          Direction: {isFlipped ? 'Romanian → English' : 'English → Romanian'}
          {timerMode && (
            <span>
              Mode: Timer ({timerDuration}s)
            </span>
          )}
          {shuffledDeckMode && !timerMode && (
            <span>
              Mode: Shuffled Deck ({remainingCards.length} remaining)
            </span>
          )}
        </div>
      )}
    </div>
  );

  const AddCardTab = () => (
    <div className="card">
      <h2 className="component-title">Add New Flashcard</h2>
      
      <form onSubmit={addCard}>
        <div className="form-group">
          <label htmlFor="english">English Text:</label>
          <textarea
            id="english"
            value={newCard.english}
            onChange={(e) => setNewCard({ ...newCard, english: e.target.value })}
            placeholder="Enter English text..."
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="romanian">Romanian Text:</label>
          <textarea
            id="romanian"
            value={newCard.romanian}
            onChange={(e) => setNewCard({ ...newCard, romanian: e.target.value })}
            placeholder="Enter Romanian text..."
            required
          />
        </div>
        
        <button type="submit" className="btn btn-success" disabled={loading}>
          <Plus size={20} />
          Add Card
        </button>
      </form>
    </div>
  );

  const BulkImportTab = () => (
    <div className="card">
      <h2 className="component-title">Bulk Import Cards</h2>
      
      <div className="info-section">
        <strong>Format:</strong> Paste text with Romanian:English pairs, one per line.
        <br />
        <strong>Example:</strong>
        <pre>
{`ceai: tea
cine: who
Bună dimineața!: Good morning!
La revedere!: Goodbye!`}
        </pre>
        Section headers (without colons) will be automatically skipped.
      </div>
      
      <div className="form-group">
        <label htmlFor="bulkText">Paste your text here:</label>
        <textarea
          id="bulkText"
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder="Paste your Romanian:English pairs here..."
          rows="12"
          style={{ fontFamily: 'monospace', fontSize: '13px' }}
        />
      </div>
      
      <div className="form-group">
        <label className="study-control-item">
          <input
            type="checkbox"
            checked={skipDuplicates}
            onChange={(e) => setSkipDuplicates(e.target.checked)}
          />
          Skip duplicate cards (based on Romanian text)
        </label>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          className="btn btn-secondary" 
          onClick={previewBulkCards}
          disabled={!bulkText.trim() || loading}
        >
          <FileText size={20} />
          Preview ({bulkPreview.length} cards)
        </button>
        
        <button 
          className="btn btn-success" 
          onClick={addBulkCards}
          disabled={!bulkText.trim() || loading}
        >
          <Upload size={20} />
          Import Cards
        </button>
      </div>
      
      {showPreview && bulkPreview.length > 0 && (
        <div className="bulk-preview">
          <h3 style={{ marginBottom: '15px' }}>
            Preview ({bulkPreview.length} cards will be imported)
          </h3>
          <div className="preview-list">
            {bulkPreview.slice(0, 10).map((card, index) => (
              <div key={index} className="preview-item">
                <span className="preview-romanian">{card.romanian}</span>
                <span className="preview-arrow">→</span>
                <span className="preview-english">{card.english}</span>
              </div>
            ))}
            {bulkPreview.length > 10 && (
              <div className="preview-more">
                ... and {bulkPreview.length - 10} more cards
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const ManageCardsTab = () => (
    <div className="card">
      <h2 className="component-title">
        Manage Cards ({cards.length} total)
      </h2>
      
      {cards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <p>No flashcards yet. Add some cards to get started!</p>
        </div>
      ) : (
        <div className="card-list">
          {cards.map((card) => (
            <div key={card.id} className="card-item">
              <div className="card-content">
                <div className="card-english">{card.english}</div>
                <div className="card-romanian">{card.romanian}</div>
              </div>
              <div className="card-actions">
                <button
                  className="btn btn-danger btn-small"
                  onClick={() => deleteCard(card.id)}
                  disabled={loading}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className={`container ${darkMode ? 'dark-mode' : ''}`}>
      <header className="header">
        <div className="header-content">
          <div className="header-text">
            <h1>🏛️ Learn Romanian</h1>
            <p>Master Romanian with interactive flashcards</p>
          </div>
          <button 
            className="theme-toggle" 
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <nav className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === 'study' ? 'active' : ''}`}
          onClick={() => setActiveTab('study')}
        >
          <BookOpen size={20} />
          <span>Study</span>
        </button>
        <button
          className={`nav-tab ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          <Plus size={20} />
          <span>Add Cards</span>
        </button>
        <button
          className={`nav-tab ${activeTab === 'bulk' ? 'active' : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          <Upload size={20} />
          <span>Bulk Import</span>
        </button>
        <button
          className={`nav-tab ${activeTab === 'manage' ? 'active' : ''}`}
          onClick={() => setActiveTab('manage')}
        >
          <List size={20} />
          <span>Manage Cards</span>
        </button>
      </nav>

      {loading && <div className="loading">Loading...</div>}

      <main>
        {activeTab === 'study' && <StudyTab />}
        {activeTab === 'add' && <AddCardTab />}
        {activeTab === 'bulk' && <BulkImportTab />}
        {activeTab === 'manage' && <ManageCardsTab />}
      </main>
    </div>
  );
}

export default App; 