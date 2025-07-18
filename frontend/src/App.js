import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { Shuffle, Plus, BookOpen, List, WalletCards, RotateCcw, Trash2, Upload, FileText, Clock, Play, Pause, SkipForward, Volume2, Moon, Sun, Edit, Save, X } from 'lucide-react';
import './index.css';

const API_BASE_URL = '/api';

function App() {
  const [activeTab, setActiveTab] = useState('study');
  const [cards, setCards] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false); // true = Romanian to English, false = English to Romanian
  const [loading, setLoading] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Manage cards state for pagination, sorting, search
  const [manageCards, setManageCards] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Points system state
  const [points, setPoints] = useState(() => {
    const saved = localStorage.getItem('romanianLearningPoints');
    return saved ? parseInt(saved) : 0;
  });
  const [dailyStreak, setDailyStreak] = useState(() => {
    const saved = localStorage.getItem('romanianLearningStreak');
    return saved ? JSON.parse(saved) : { count: 0, lastStudyDate: null };
  });
  const [achievements, setAchievements] = useState(() => {
    const saved = localStorage.getItem('romanianLearningAchievements');
    return saved ? JSON.parse(saved) : [];
  });
  const [recentPoints, setRecentPoints] = useState(null); // For showing point animations

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
  const [newCard, setNewCard] = useState({ english: '', romanian: '', tags: '' });
  
  // Edit card state
  const [editingCard, setEditingCard] = useState(null);
  const [editCard, setEditCard] = useState({ english: '', romanian: '', tags: '' });
  
  // Tags state
  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagFilter, setTagFilter] = useState('');
  
  // Bulk import state
  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  
  // Progress bar state for bulk import
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [importInProgress, setImportInProgress] = useState(false);
  const [importStats, setImportStats] = useState({ current: 0, total: 0 });

  const bulkTextRef = useRef(null);

  useEffect(() => {
    fetchCards();
    fetchManageCards();
    fetchAllTags();
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch manage cards when filters change
  useEffect(() => {
    if (activeTab === 'manage') {
      fetchManageCards();
    }
  }, [currentPage, pageSize, sortBy, sortOrder, debouncedSearchTerm, selectedTags, activeTab]);

  // Prevent backspace from navigating back when not in input fields
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent backspace from navigating back unless in input/textarea
      if (e.key === 'Backspace' && 
          e.target.tagName !== 'INPUT' && 
          e.target.tagName !== 'TEXTAREA' &&
          !e.target.isContentEditable) {
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
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

  // Points system effects
  useEffect(() => {
    localStorage.setItem('romanianLearningPoints', points.toString());
  }, [points]);

  useEffect(() => {
    localStorage.setItem('romanianLearningStreak', JSON.stringify(dailyStreak));
  }, [dailyStreak]);

  useEffect(() => {
    localStorage.setItem('romanianLearningAchievements', JSON.stringify(achievements));
  }, [achievements]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Points system functions
  const awardPoints = (amount, reason) => {
    setPoints(prev => prev + amount);
    setRecentPoints({ amount, reason });
    
    // Show point notification for 2 seconds
    setTimeout(() => {
      setRecentPoints(null);
    }, 2000);
    
    // Check for new achievements
    checkAchievements(points + amount);
  };

  const updateDailyStreak = () => {
    const today = new Date().toDateString();
    const lastStudyDate = dailyStreak.lastStudyDate;
    
    if (lastStudyDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastStudyDate === yesterday.toDateString()) {
        // Consecutive day
        setDailyStreak({
          count: dailyStreak.count + 1,
          lastStudyDate: today
        });
        awardPoints(5, `Daily streak: ${dailyStreak.count + 1} days!`);
      } else {
        // New streak or broken streak
        setDailyStreak({
          count: 1,
          lastStudyDate: today
        });
        if (lastStudyDate !== null) {
          awardPoints(1, 'Back to studying!');
        }
      }
    }
  };

  const checkAchievements = (currentPoints) => {
    const possibleAchievements = [
      { id: 'first_points', name: 'First Steps', description: 'Earned your first points!', threshold: 1, points: 10 },
      { id: 'dedicated_learner', name: 'Dedicated Learner', description: 'Earned 100 points!', threshold: 100, points: 25 },
      { id: 'language_enthusiast', name: 'Language Enthusiast', description: 'Earned 500 points!', threshold: 500, points: 50 },
      { id: 'romanian_scholar', name: 'Romanian Scholar', description: 'Earned 1000 points!', threshold: 1000, points: 100 },
      { id: 'deck_master', name: 'Deck Master', description: 'Completed your first shuffled deck!', threshold: 0, points: 20 },
      { id: 'speed_learner', name: 'Speed Learner', description: 'Completed 10 timer challenges!', threshold: 0, points: 30 },
      { id: 'streak_warrior', name: 'Streak Warrior', description: 'Maintained a 7-day study streak!', threshold: 0, points: 50 },
    ];

    possibleAchievements.forEach(achievement => {
      if (!achievements.some(a => a.id === achievement.id)) {
        let shouldUnlock = false;
        
        if (achievement.id === 'first_points' && currentPoints >= 1) shouldUnlock = true;
        if (achievement.id === 'dedicated_learner' && currentPoints >= 100) shouldUnlock = true;
        if (achievement.id === 'language_enthusiast' && currentPoints >= 500) shouldUnlock = true;
        if (achievement.id === 'romanian_scholar' && currentPoints >= 1000) shouldUnlock = true;
        
        if (shouldUnlock) {
          setAchievements(prev => [...prev, { ...achievement, unlockedAt: new Date().toISOString() }]);
          setSuccess(`🏆 Achievement Unlocked: ${achievement.name}! +${achievement.points} bonus points!`);
          setTimeout(() => setPoints(p => p + achievement.points), 1000);
        }
      }
    });
  };

  const unlockSpecialAchievement = (achievementId) => {
    const specialAchievements = {
      'deck_master': { name: 'Deck Master', description: 'Completed your first shuffled deck!', points: 20 },
      'speed_learner': { name: 'Speed Learner', description: 'Completed 10 timer challenges!', points: 30 },
      'streak_warrior': { name: 'Streak Warrior', description: 'Maintained a 7-day study streak!', points: 50 },
    };
    
    if (!achievements.some(a => a.id === achievementId) && specialAchievements[achievementId]) {
      const achievement = specialAchievements[achievementId];
      setAchievements(prev => [...prev, { id: achievementId, ...achievement, unlockedAt: new Date().toISOString() }]);
      setSuccess(`🏆 Achievement Unlocked: ${achievement.name}! +${achievement.points} bonus points!`);
      setTimeout(() => setPoints(p => p + achievement.points), 1000);
    }
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
      const response = await axios.get(`${API_BASE_URL}/cards/all`);
      setCards(response.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch cards');
      console.error('Error fetching cards:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchManageCards = async () => {
    try {
      setManageLoading(true);
      
      // If tags are selected, use the filter endpoint
      if (selectedTags.length > 0) {
        const params = new URLSearchParams();
        selectedTags.forEach(tag => params.append('tags', tag));
        if (debouncedSearchTerm.trim()) {
          params.append('search', debouncedSearchTerm);
        }
        
        const response = await axios.get(`${API_BASE_URL}/cards/filter?${params}`);
        const allFilteredCards = response.data;
        
        // Apply client-side pagination and sorting for filtered results
        const sortedCards = [...allFilteredCards].sort((a, b) => {
          if (sortBy === 'created_at') {
            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
          } else {
            const valA = (a[sortBy] || '').toLowerCase();
            const valB = (b[sortBy] || '').toLowerCase();
            if (sortOrder === 'desc') {
              return valB.localeCompare(valA);
            } else {
              return valA.localeCompare(valB);
            }
          }
        });
        
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedCards = sortedCards.slice(startIndex, endIndex);
        
        setManageCards(paginatedCards);
        setTotalCount(sortedCards.length);
        setTotalPages(Math.ceil(sortedCards.length / pageSize));
      } else {
        // Use regular paginated endpoint when no tags selected
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: pageSize.toString(),
          sort_by: sortBy,
          sort_order: sortOrder,
          search: debouncedSearchTerm
        });
        
        const response = await axios.get(`${API_BASE_URL}/cards?${params}`);
        setManageCards(response.data.cards);
        setTotalPages(response.data.pagination.total_pages);
        setTotalCount(response.data.pagination.total_count);
      }
      
      setError('');
    } catch (err) {
      setError('Failed to fetch manage cards');
      console.error('Error fetching manage cards:', err);
    } finally {
      setManageLoading(false);
    }
  };

  const fetchAllTags = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/tags`);
      setAllTags(response.data.tags);
    } catch (err) {
      console.error('Error fetching tags:', err);
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
    // Don't award points automatically - user should use "I was correct" button
    
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

  // Function to award points when user says they were correct
  const markAsCorrect = () => {
    if (currentCard && showAnswer) {
      updateDailyStreak();
      
      if (timerMode) {
        awardPoints(5, 'Correct answer in timer mode!');
      } else {
        awardPoints(3, 'Correct answer!');
      }
      
      // Optionally auto-advance to next card after marking correct
      setTimeout(() => {
        nextCard();
      }, 1500); // Give time to see the point animation
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
        // Deck completed, award bonus points
        awardPoints(10, `Deck completed! (${completedCards.length} cards)`);
        unlockSpecialAchievement('deck_master');
        
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
      
      // Prepare card data with tags
      const cardData = {
        english: newCard.english.trim(),
        romanian: newCard.romanian.trim(),
        tags: newCard.tags.trim()
      };
      
      await axios.post(`${API_BASE_URL}/cards`, cardData);
      setNewCard({ english: '', romanian: '', tags: '' });
      
      // Award points for adding a new card
      awardPoints(5, 'New card added!');
      
      setSuccess('Card added successfully!');
      setError('');
      await fetchCards();
      // Refresh manage cards and tags
      if (activeTab === 'manage') {
        await fetchManageCards();
      }
      await fetchAllTags();
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
      await fetchCards(); // Refresh the list
      await fetchManageCards(); // Refresh manage cards list
      setSuccess('Card deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
    } catch (err) {
      setError('Failed to delete card');
      console.error('Error deleting card:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateCard = async (cardId) => {
    if (!editCard.english.trim() || !editCard.romanian.trim()) {
      setError('Both English and Romanian text are required');
      return;
    }

    try {
      setLoading(true);
      await axios.put(`${API_BASE_URL}/cards/${cardId}`, {
        english: editCard.english,
        romanian: editCard.romanian,
        tags: editCard.tags
      });
      await fetchCards(); // Refresh the list
      await fetchManageCards(); // Refresh manage cards list
      await fetchAllTags(); // Refresh tags
      setEditingCard(null);
      setEditCard({ english: '', romanian: '', tags: '' });
      setSuccess('Card updated successfully');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
    } catch (err) {
      setError('Failed to update card');
      console.error('Error updating card:', err);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (card) => {
    setEditingCard(card.id);
    setEditCard({ 
      english: card.english, 
      romanian: card.romanian,
      tags: card.tags ? card.tags.join(', ') : ''
    });
  };

  const cancelEditing = () => {
    setEditingCard(null);
    setEditCard({ english: '', romanian: '', tags: '' });
  };

  const parseBulkText = (text) => {
    const cards = [];
    const lines = text.trim().split('\n');
    
    const isSeparatingComma = (romanianText) => {
      // If the text contains sentence punctuation (! ? .), treat commas as part of the phrase
      if (/[!?.]+/.test(romanianText)) {
        return false;
      }
      
      // If the text has multiple words AND common greeting/phrase patterns, likely a sentence
      const words = romanianText.trim().split(/\s+/);
      if (words.length > 2) { // More than 2 words usually indicates a phrase/sentence
        return false;
      }
      
      // Check for common Romanian greeting/phrase patterns that shouldn't be split
      const phrasePatterns = [
        'bună dimineața', 'bună ziua', 'bună seara', 'la revedere',
        'ce mai', 'și eu', 'bine ați', 'mulțumesc', 'și tu',
        'bună,', 'salut,'  // Greetings with names
      ];
      
      const textLower = romanianText.toLowerCase();
      for (const pattern of phrasePatterns) {
        if (textLower.includes(pattern)) {
          return false;
        }
      }
      
      // If we have exactly 2 words separated by comma, likely vocabulary variants
      const commaParts = romanianText.split(',').map(part => part.trim());
      if (commaParts.length === 2) {
        // Check if second part starts with capital letter (likely a name)
        if (commaParts[1] && commaParts[1][0] && commaParts[1][0] === commaParts[1][0].toUpperCase()) {
          return false;  // Likely "Greeting, Name" format
        }
        
        // Both parts should be relatively short (single words or short phrases)
        // and both should be lowercase words (not names)
        if (commaParts.every(part => part.split(/\s+/).length <= 2)) {
          // Additional check: if either part contains multiple words, less likely to be vocabulary variants
          if (commaParts.some(part => part.split(/\s+/).length > 1)) {
            return false;
          }
          return true;
        }
      }
      
      // For lists of 3+ comma-separated items that are all short, likely vocabulary
      if (commaParts.length >= 3) {
        if (commaParts.every(part => part.split(/\s+/).length === 1)) { // All single words
          return true;
        }
      }
      
      // Default: treat commas as part of phrase
      return false;
    };

    const shouldSplitOnSlashes = (romanianText) => {
      // Split on slashes if they exist (treating them as alternative forms)
      return romanianText.includes('/');
    };
    
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
      
      // Store original for potential restoration
      const originalRomanian = romanian;
      const originalEnglish = english;
      
      // Remove trailing punctuation for parsing
      romanian = romanian.replace(/[!?.]+$/, '');
      english = english.replace(/[!?.]+$/, '');
      
      // Handle slashes as alternative forms
      if (shouldSplitOnSlashes(romanian)) {
        // Create card for the full form (original with punctuation restored)
        cards.push({
          romanian: originalRomanian,
          english: originalEnglish
        });
        
        // Create individual cards for each alternative form
        const alternatives = originalRomanian.split('/').map(alt => alt.trim());
        for (let alt of alternatives) {
          alt = alt.trim();
          if (alt && alt.length >= 2) { // Skip empty or very short alternatives
            cards.push({
              romanian: alt,
              english: originalEnglish
            });
          }
        }
      }
      // Check if Romanian side has comma-separated vocabulary items vs phrases with commas
      else if (romanian.includes(',') && isSeparatingComma(romanian)) {
        // Create card for the full form (original with punctuation restored)
        cards.push({
          romanian: originalRomanian,
          english: originalEnglish
        });
        
        // Create individual cards for each vocabulary word/phrase
        const romanianWords = romanian.split(',').map(word => word.trim());
        for (let word of romanianWords) {
          word = word.trim();
          if (word && word.length >= 2) { // Skip empty or very short words
            cards.push({
              romanian: word,
              english: originalEnglish
            });
          }
        }
      } else {
        // Single phrase/sentence or phrase with non-separating commas - keep as one card
        cards.push({
          romanian: originalRomanian,
          english: originalEnglish
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
      setImportInProgress(true);
      setImportProgress(0);
      setImportStatus('Preparing import...');
      setImportStats({ current: 0, total: 0 });
      setError('');
      setSuccess(''); // Clear any previous success messages

      // Use fetch with streaming to track progress
      const response = await fetch(`${API_BASE_URL}/cards/bulk/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: bulkText,
          skip_duplicates: skipDuplicates
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body not available');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              if (data.type === 'progress') {
                // Throttle progress updates to prevent rapid DOM changes
                const now = Date.now();
                if (!window.lastProgressUpdate || now - window.lastProgressUpdate > 100) {
                  setImportProgress(data.percentage);
                  setImportStatus(data.status);
                  setImportStats({ current: data.current, total: data.total });
                  window.lastProgressUpdate = now;
                }
              } else if (data.type === 'complete') {
                setImportProgress(100);
                setImportStatus('Import completed!');
                
                // Clean up
                setBulkText('');
                setBulkPreview([]);
                setShowPreview(false);
                
                // Award points for bulk import
                if (data.added_count > 0) {
                  const bonusPoints = Math.min(data.added_count * 2, 50); // 2 points per card, max 50
                  awardPoints(bonusPoints, `Bulk import: ${data.added_count} cards!`);
                }
                
                let message = `Successfully imported ${data.added_count} cards`;
                if (data.skipped_count > 0) {
                  message += ` (${data.skipped_count} duplicates skipped)`;
                }
                message += ` out of ${data.total_parsed} parsed entries.`;
                
                setSuccess(message);
                await fetchCards();
                await fetchManageCards(); // Refresh manage cards list
                setTimeout(() => {
                  setSuccess('');
                  setImportInProgress(false);
                  setImportProgress(0);
                  setImportStatus('');
                  setImportStats({ current: 0, total: 0 });
                }, 3000);
                return; // Exit the function
              } else if (data.type === 'error') {
                throw new Error(data.message);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
              // If it's a JSON parse error, continue; if it's a thrown error, re-throw
              if (e.message.includes('JSON') || e.message.includes('parse')) {
                continue;
              } else {
                throw e;
              }
            }
          }
        }
      }

    } catch (err) {
      setError(err.message || 'Failed to import cards');
      console.error('Error importing bulk cards:', err);
      setImportInProgress(false);
      setImportProgress(0);
      setImportStatus('');
      setImportStats({ current: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  };

  const StudyTab = useMemo(() => (
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
          onClick={(e) => {
            // Don't handle click if it's from a keyboard event or if target is an input
            if (e.detail === 0 || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
              return;
            }
            
            // Don't flip card if user is selecting text
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) {
              return;
            }
            
            // Don't flip card if clicking directly on flashcard text (to allow text selection)
            if (e.target.classList.contains('flashcard-text')) {
              return;
            }
            
            if (allowClickInTimer || !timerMode) {
                          if (timerMode && timerActive && !showAnswer) {
              // Stop timer when clicking early
              setTimerActive(false);
              setTimeLeft(0);
            }
            
            // Don't award points automatically - let user decide if they were correct
            
            setShowAnswer(!showAnswer);
            }
          }}
          onKeyDown={(e) => {
            // Only handle Space and Enter keys for flashcard interaction
            if (e.key === ' ' || e.key === 'Enter') {
              // Only if we're not in an input field
              if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                if (allowClickInTimer || !timerMode) {
                  if (timerMode && timerActive && !showAnswer) {
                    setTimerActive(false);
                    setTimeLeft(0);
                  }
                  
                  // Don't award points automatically - let user decide if they were correct
                  
                  setShowAnswer(!showAnswer);
                }
              }
            }
          }}
          tabIndex={0}
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
          
          {/* Correctness and TTS Controls */}
          {currentCard && (
            <div className="flashcard-actions" style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
              
              {/* Correctness Button - only show when answer is revealed */}
              {showAnswer && (
                <div className="correctness-controls">
                  <button 
                    className="btn btn-success" 
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsCorrect();
                    }}
                    style={{ 
                      fontSize: '1.1rem', 
                      padding: '12px 24px',
                      background: 'linear-gradient(135deg, #28a745, #20c997)',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)',
                      animation: 'pulse 2s infinite'
                    }}
                  >
                    ✅ I was correct! (+{timerMode ? '5' : '3'} points)
                  </button>
                  <button 
                    className="btn btn-secondary btn-small" 
                    onClick={(e) => {
                      e.stopPropagation();
                      // Just go to next card without points
                      nextCard();
                    }}
                    style={{ 
                      marginTop: '5px',
                      opacity: '0.7',
                      fontSize: '0.9rem'
                    }}
                  >
                    I was wrong - Next card
                  </button>
                </div>
              )}

              {/* Text-to-Speech Controls */}
              {ttsEnabled && (
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
  ), [timerMode, ttsEnabled, shuffledDeckMode, cards, completedCards, deckProgress, remainingCards, timerDuration, timerActive, allowClickInTimer, currentCard, timeLeft, loading, showAnswer, isFlipped, startTimer, pauseTimer, skipTimer, resetTimer, nextCard, getShuffledCard, initializeShuffledDeck, getRandomCard, speakRomanian, speakEnglish, speaking]);

  const AddCardTab = useMemo(() => (
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
        
        <div className="form-group">
          <label htmlFor="tags">Tags (optional):</label>
          <input
            type="text"
            id="tags"
            value={newCard.tags}
            onChange={(e) => setNewCard({ ...newCard, tags: e.target.value })}
            placeholder="Enter tags separated by commas (e.g., greetings, questions, food)"
          />
          <small className="form-help">
            Add tags to categorize your cards. Separate multiple tags with commas.
          </small>
        </div>
        
        <button type="submit" className="btn btn-success" disabled={loading}>
          <Plus size={20} />
          Add Card
        </button>
      </form>
    </div>
  ), [newCard, loading, addCard]);

  const BulkImportTab = useMemo(() => (
    <div className="card">
      <h2 className="component-title">Bulk Import Cards</h2>
      
      <div className="info-section">
        <strong>Format:</strong> Paste text with Romanian:English pairs, one per line.
        <br />
        <strong>Alternative forms:</strong> Use "/" to separate alternative Romanian phrases that have the same English meaning.
        <br />
        <strong>Tags:</strong> Add tags in square brackets after English text: "text [tag1, tag2]"
        <br />
        <strong>Example:</strong>
        <pre>
{`ceai: tea [drinks]
cine: who [questions]
Bună dimineața!: Good morning! [greetings]
La revedere!: Goodbye! [greetings]
Cum te numești? / cum te cheamă?: What is your name? [questions]`}
        </pre>
        Section headers (without colons) will be automatically skipped.
        <br />
        Lines with "/" will create both a combined card and individual cards for each alternative form.
      </div>
      
      <div className="form-group">
        <label htmlFor="bulkText">Paste your text here:</label>
        <textarea
          ref={bulkTextRef}
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
          disabled={!bulkText.trim() || loading || importInProgress}
        >
          <FileText size={20} />
          Preview ({bulkPreview.length} cards)
        </button>
        
        <button 
          className="btn btn-success" 
          onClick={addBulkCards}
          disabled={!bulkText.trim() || loading || importInProgress}
        >
          <Upload size={20} />
          {importInProgress ? 'Importing..' : 'Import Cards'}
        </button>
      </div>
      
      {/* Progress Bar */}
      {importInProgress && (
        <div className="import-progress">
          <div className="import-progress-header">
            <span className="import-progress-title">
              📊 Import Progress: {importStats.current} / {importStats.total} cards
            </span>
            <span className="import-progress-percent">
              {importProgress}%
            </span>
          </div>
          <div className="import-progress-bar">
            <div 
              className="import-progress-fill"
              style={{ width: `${importProgress}%` }}
            ></div>
          </div>
          <div className="import-progress-status">
            {importStatus}
          </div>
        </div>
      )}
      
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
  ), [bulkText, skipDuplicates, loading, importInProgress, bulkPreview, showPreview, importProgress, importStats, importStatus, previewBulkCards, addBulkCards]);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  }, []);

  const handleSortChange = useCallback((field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  }, [sortBy, sortOrder]);

  const handlePageSizeChange = useCallback((e) => {
    setPageSize(parseInt(e.target.value));
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  const getSortIcon = useCallback((field) => {
    if (sortBy !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  }, [sortBy, sortOrder]);

  const generatePageNumbers = useCallback(() => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust start if we're near the end
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages]);

  const searchInputRef = useRef(null);

  const ManageCardsTab = useMemo(() => {

    return (
      <div className="card">
        <div className="manage-cards-header">
          <h2 className="component-title">
            Manage Cards ({manageLoading ? '...' : totalCount} total)
          </h2>
          
          {/* Search and Controls */}
          <div className="manage-controls">
            <div className="search-section">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search cards..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="search-input"
              />
              {manageLoading && searchTerm !== debouncedSearchTerm && (
                <small style={{ color: 'var(--text-muted)', marginTop: '5px', display: 'block' }}>
                  Searching...
                </small>
              )}
            </div>
            
            {/* Tag Filter */}
            {allTags.length > 0 && (
              <div className="tag-filter-section">
                <label>Filter by tags:</label>
                <div className="tag-filter-list">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      className={`tag-filter ${selectedTags.includes(tag) ? 'active' : ''}`}
                      onClick={() => {
                        if (selectedTags.includes(tag)) {
                          setSelectedTags(selectedTags.filter(t => t !== tag));
                        } else {
                          setSelectedTags([...selectedTags, tag]);
                        }
                        setCurrentPage(1); // Reset to first page when filtering
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                  {selectedTags.length > 0 && (
                    <button
                      className="clear-filters"
                      onClick={() => {
                        setSelectedTags([]);
                        setCurrentPage(1);
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            )}
            
            <div className="controls-section">
              <div className="page-size-control">
                <label>Show:</label>
                <select value={pageSize} onChange={handlePageSizeChange}>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span>per page</span>
              </div>
            </div>
          </div>
        </div>
        
        {manageLoading ? (
          <div className="loading">Loading cards...</div>
        ) : totalCount === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <p>{searchTerm ? 'No cards found matching your search.' : 'No flashcards yet. Add some cards to get started!'}</p>
          </div>
        ) : (
          <>
            {/* Sort Headers */}
            <div className="sort-headers">
              <button 
                className={`sort-header ${sortBy === 'english' ? 'active' : ''}`}
                onClick={() => handleSortChange('english')}
              >
                English {getSortIcon('english')}
              </button>
              <button 
                className={`sort-header ${sortBy === 'romanian' ? 'active' : ''}`}
                onClick={() => handleSortChange('romanian')}
              >
                Romanian {getSortIcon('romanian')}
              </button>
              <button 
                className={`sort-header ${sortBy === 'created_at' ? 'active' : ''}`}
                onClick={() => handleSortChange('created_at')}
              >
                Date Created {getSortIcon('created_at')}
              </button>
              <div className="sort-header-actions">Actions</div>
            </div>

            {/* Cards List */}
            <div className="card-list">
              {manageCards.map((card) => (
                <div key={card.id} className="card-item">
                  {editingCard === card.id ? (
                    // Edit mode
                    <div className="card-edit-form">
                      <div className="form-group">
                        <label>English:</label>
                        <input
                          type="text"
                          value={editCard.english}
                          onChange={(e) => setEditCard({ ...editCard, english: e.target.value })}
                          placeholder="Enter English text"
                        />
                      </div>
                      <div className="form-group">
                        <label>Romanian:</label>
                        <input
                          type="text"
                          value={editCard.romanian}
                          onChange={(e) => setEditCard({ ...editCard, romanian: e.target.value })}
                          placeholder="Enter Romanian text"
                        />
                      </div>
                      <div className="form-group">
                        <label>Tags:</label>
                        <input
                          type="text"
                          value={editCard.tags}
                          onChange={(e) => setEditCard({ ...editCard, tags: e.target.value })}
                          placeholder="Enter tags separated by commas"
                        />
                      </div>
                      <div className="card-actions">
                        <button
                          className="btn btn-success btn-small"
                          onClick={() => updateCard(card.id)}
                          disabled={loading || !editCard.english.trim() || !editCard.romanian.trim()}
                        >
                          <Save size={16} />
                          Save
                        </button>
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={cancelEditing}
                          disabled={loading}
                        >
                          <X size={16} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <div className="card-content">
                        <div className="card-english">{card.english}</div>
                        <div className="card-romanian">{card.romanian}</div>
                        {card.tags && card.tags.length > 0 && (
                          <div className="card-tags">
                            {card.tags.map((tag, index) => (
                              <span key={index} className="tag">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="card-date">
                          {new Date(card.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="card-actions">
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => startEditing(card)}
                          disabled={loading || editingCard !== null}
                        >
                          <Edit size={16} />
                          Edit
                        </button>
                        <button
                          className="btn btn-danger btn-small"
                          onClick={() => deleteCard(card.id)}
                          disabled={loading || editingCard !== null}
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <div className="pagination-info">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} cards
                </div>
                
                <div className="pagination-controls">
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                  >
                    First
                  </button>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  
                  {generatePageNumbers().map(page => (
                    <button
                      key={page}
                      className={`btn btn-small ${page === currentPage ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </button>
                  ))}
                  
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }, [manageLoading, totalCount, searchTerm, handleSearchChange, manageCards, sortBy, sortOrder, handleSortChange, getSortIcon, allTags, selectedTags, setSelectedTags, tagFilter, setTagFilter, currentPage, pageSize, handlePageSizeChange, totalPages, handlePageChange, generatePageNumbers, editingCard, editCard, setEditCard, updateCard, cancelEditing, startEditing, deleteCard, loading]);

  const AchievementsTab = useMemo(() => (
    <div className="card">
      <h2 className="component-title">
        🏆 Achievements & Progress
      </h2>
      
      {/* Stats Overview */}
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-content">
            <div className="stat-value">{points.toLocaleString()}</div>
            <div className="stat-label">Total Points</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-content">
            <div className="stat-value">{dailyStreak.count}</div>
            <div className="stat-label">Day Streak</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🏆</div>
          <div className="stat-content">
            <div className="stat-value">{achievements.length}</div>
            <div className="stat-label">Achievements</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📚</div>
          <div className="stat-content">
            <div className="stat-value">{cards.length}</div>
            <div className="stat-label">Total Cards</div>
          </div>
        </div>
      </div>
      
      {/* Points Earning Guide */}
      <div className="points-guide">
        <h3>How to Earn Points</h3>
        <div className="points-list">
          <div className="points-item">
            <span className="points-amount">+3</span>
            <span className="points-description">Get a flashcard correct (regular mode)</span>
          </div>
          <div className="points-item">
            <span className="points-amount">+5</span>
            <span className="points-description">Get a flashcard correct (timer mode)</span>
          </div>
          <div className="points-item">
            <span className="points-amount">+5</span>
            <span className="points-description">Daily streak bonus</span>
          </div>
          <div className="points-item">
            <span className="points-amount">+5</span>
            <span className="points-description">Add a new flashcard</span>
          </div>
          <div className="points-item">
            <span className="points-amount">+10</span>
            <span className="points-description">Complete a shuffled deck</span>
          </div>
          <div className="points-item">
            <span className="points-amount">+2 each</span>
            <span className="points-description">Bulk import cards (max 50 points)</span>
          </div>
        </div>
      </div>

      {/* Achievement Showcase */}
      <div className="achievements-section">
        <h3>Achievement Gallery</h3>
        {achievements.length === 0 ? (
          <div className="no-achievements">
            <div className="empty-state-icon">🎯</div>
            <p>No achievements yet! Start studying to unlock your first achievement.</p>
          </div>
        ) : (
          <div className="achievements-grid">
            {achievements.map((achievement, index) => (
              <div key={achievement.id} className="achievement-card earned">
                <div className="achievement-icon">🏆</div>
                <div className="achievement-content">
                  <div className="achievement-name">{achievement.name}</div>
                  <div className="achievement-description">{achievement.description}</div>
                  <div className="achievement-points">+{achievement.points} points</div>
                  <div className="achievement-date">
                    Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Available Achievements */}
        <h3>Available Achievements</h3>
        <div className="achievements-grid">
          {[
            { id: 'first_points', name: 'First Steps', description: 'Earn your first points!', points: 10 },
            { id: 'dedicated_learner', name: 'Dedicated Learner', description: 'Earn 100 points!', points: 25 },
            { id: 'language_enthusiast', name: 'Language Enthusiast', description: 'Earn 500 points!', points: 50 },
            { id: 'romanian_scholar', name: 'Romanian Scholar', description: 'Earn 1000 points!', points: 100 },
            { id: 'deck_master', name: 'Deck Master', description: 'Complete your first shuffled deck!', points: 20 },
            { id: 'speed_learner', name: 'Speed Learner', description: 'Complete 10 timer challenges!', points: 30 },
            { id: 'streak_warrior', name: 'Streak Warrior', description: 'Maintain a 7-day study streak!', points: 50 },
          ].filter(achievement => !achievements.some(a => a.id === achievement.id)).map((achievement) => (
            <div key={achievement.id} className="achievement-card locked">
              <div className="achievement-icon">🔒</div>
              <div className="achievement-content">
                <div className="achievement-name">{achievement.name}</div>
                <div className="achievement-description">{achievement.description}</div>
                <div className="achievement-points">+{achievement.points} points</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Manual Points Button for Testing */}
      <div className="debug-section" style={{ marginTop: '30px', padding: '20px', border: '2px dashed #ccc', borderRadius: '8px' }}>
        <h3>🎯 Quick Actions</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => awardPoints(10, 'Manual bonus!')}
          >
            +10 Points (Test)
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              setPoints(0);
              setAchievements([]);
              setDailyStreak({ count: 0, lastStudyDate: null });
            }}
          >
            Reset Progress
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              awardPoints(25, 'Adding new cards!');
            }}
          >
            Card Creator Bonus (+25)
          </button>
        </div>
      </div>
    </div>
  ), [points, dailyStreak, achievements, cards.length, awardPoints]);

  return (
    <div className={`container ${darkMode ? 'dark-mode' : ''}`}>
      <header className="header">
        <div className="header-content">
          {/* Centered Title */}
          <div className="header-text">
            <h1>Learn Romanian</h1>
            <p>Master Romanian with interactive flashcards</p>
          </div>
          
          {/* Stats Display - Under Title */}
          <div className="stats-display">
            <div className="stat-item">
              <span className="stat-icon">⭐</span>
              <div className="stat-content">
                <span className="stat-value">{points.toLocaleString()}</span>
                <span className="stat-label">points</span>
              </div>
            </div>
            
            {dailyStreak.count > 0 && (
              <div className="stat-item">
                <span className="stat-icon">🔥</span>
                <div className="stat-content">
                  <span className="stat-value">{dailyStreak.count}</span>
                  <span className="stat-label">day streak</span>
                </div>
              </div>
            )}
            
            {achievements.length > 0 && (
              <button 
                className="stat-item stat-button"
                onClick={() => setActiveTab('achievements')}
                title={`${achievements.length} achievements unlocked`}
              >
                <span className="stat-icon">🏆</span>
                <div className="stat-content">
                  <span className="stat-value">{achievements.length}</span>
                  <span className="stat-label">achievements</span>
                </div>
              </button>
            )}
            
            {/* Recent Points Animation */}
            {recentPoints && (
              <div className="recent-points-animation">
                +{recentPoints.amount} {recentPoints.reason}
              </div>
            )}
          </div>
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <nav className="nav-tabs">
        <div className="nav-tabs-left">
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
            <WalletCards size={20} />
            <span>Manage Cards</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'achievements' ? 'active' : ''}`}
            onClick={() => setActiveTab('achievements')}
          >
            <span style={{ fontSize: '20px' }}>🏆</span>
            <span>Achievements</span>
          </button>
        </div>
        
        <button 
          className="theme-toggle nav-theme-toggle" 
          onClick={toggleDarkMode}
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </nav>
      <main>
        {activeTab === 'study' && StudyTab}
        {activeTab === 'add' && AddCardTab}
        {activeTab === 'bulk' && BulkImportTab}
        {activeTab === 'manage' && ManageCardsTab}
        {activeTab === 'achievements' && AchievementsTab}
      </main>
    </div>
  );
}

export default App; 