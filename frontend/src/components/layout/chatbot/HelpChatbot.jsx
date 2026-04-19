import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import ChatWindow from './ChatWindow';

const SUGGESTED_ARTICLES = [
    {
        title: 'How can I download all files at once?',
        description: 'Learn how to use the bulk download feature',
        keywords: ['bulk', 'download-all', 'zip', 'archive'],
        content: `FileTools offers a convenient bulk download feature.
To download multiple files at once:
1. Select the files you wish to download by checking the boxes next to them.
2. Click the "Download Selected" button.
3. The files will be compressed into a single ZIP archive and downloaded to your device.
This is the easiest way to manage many files efficiently.`
    },
    {
        title: 'How secure are my files?',
        description: 'Understanding our security measures',
        keywords: ['security', 'privacy', 'encryption', 'safe'],
        content: `Your file security is our top priority.
We use industry-standard encryption protocols to protect your files during upload, storage, and download. Access to your files is strictly controlled. We do not share your files or data with third parties without your explicit consent, except where required by law.`
    },
    {
        title: 'What is a conversion minute?',
        description: 'Learn about our pricing model',
        keywords: ['pricing', 'conversion', 'minute', 'billing'],
        content: `A conversion minute is a unit used in our pricing model to measure the processing time required for file conversions.
Your subscription plan includes a certain number of conversion minutes per billing cycle. You can check your usage and remaining minutes in your account dashboard.`
    },
    {
        title: 'Supported file formats',
        description: 'Complete list of supported formats',
        keywords: ['formats', 'support', 'types', 'convert'],
        content: `FileTools supports a wide range of file formats for conversion and manipulation.
These include document types (PDF, DOCX), image formats (JPG, PNG, GIF, SVG), video formats (MP4, AVI, MOV), audio formats (MP3, WAV), and archive formats (ZIP, RAR).`
    }
];

const HelpChatbot = () => {
    const { isAuthenticated } = useAuth();

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [apiStatus, setApiStatus] = useState('checking');
    const [selectedArticle, setSelectedArticle] = useState(null);
    const messagesEndRef = useRef(null);

    const [hasOpened, setHasOpened] = useState(() => {
        return localStorage.getItem('chatbot_hasOpened') === 'true';
    });

    const [showTooltip, setShowTooltip] = useState(false);

    const [tooltipDismissed, setTooltipDismissed] = useState(() => {
        return localStorage.getItem('chatbot_tooltipDismissed') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('chatbot_hasOpened', hasOpened.toString());
    }, [hasOpened]);

    useEffect(() => {
        localStorage.setItem('chatbot_tooltipDismissed', tooltipDismissed.toString());
    }, [tooltipDismissed]);

    useEffect(() => {
        if (tooltipDismissed || isOpen) return;

        let showTimer = null;
        let hideTimer = null;

        showTimer = setTimeout(() => {
            setShowTooltip(true);

            hideTimer = setTimeout(() => {
                setShowTooltip(false);
            }, 5000);
        }, 3000);

        return () => {
            if (showTimer) clearTimeout(showTimer);
            if (hideTimer) clearTimeout(hideTimer);
        };
    }, [tooltipDismissed, isOpen]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if (isOpen && apiStatus === 'checking') {
            checkApiStatus();
        }
    }, [isOpen, apiStatus]);

    useEffect(() => {
        if (!selectedArticle && !searchQuery) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, selectedArticle, searchQuery]);

    const handleClick = () => {
        setIsOpen(true);
        setHasOpened(true);
        setShowTooltip(false);
    };

    const checkApiStatus = async () => {
        if (!navigator.onLine) { setApiStatus('error'); return; }
        try {
            await apiClient.post('/api/chat', { message: 'status check' }, { timeout: 30000 });
            setApiStatus('connected');
        } catch (error) {
            console.error('Backend status check failed:', error);
            setApiStatus('error');
        }
    };

    const handleSendMessage = async (messageText = inputValue) => {
        if (!messageText.trim()) return;

        setMessages(prev => [...prev, {
            id: Date.now(),
            type: 'user',
            content: messageText,
            timestamp: new Date()
        }]);
        setInputValue('');
        setIsTyping(true);
        setSelectedArticle(null);
        if (searchQuery) setSearchQuery('');

        try {
            const response = await apiClient.post('/api/chat', { message: messageText });
            const botReplyContent = response.data?.reply || 'Received an empty reply.';
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                type: 'bot',
                content: botReplyContent,
                timestamp: new Date(),
                suggestions: null,
                error: false
            }]);
        } catch (error) {
            console.error('Error sending message to backend:', error);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                type: 'bot',
                content: `I'm having trouble processing your request.${!isOnline ? ' You appear to be offline.' : apiStatus === 'error' ? ' The AI service might be unavailable.' : ''} Please try again or contact our support team.`,
                timestamp: new Date(),
                suggestions: ['Try again later', 'Check FAQ', 'Contact Support Team'],
                error: true
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        if (suggestion === 'Check FAQ') {
            setSearchQuery('');
            setSelectedArticle(null);
        } else {
            handleSendMessage(suggestion);
        }
        if (selectedArticle) setSelectedArticle(null);
        if (searchQuery && suggestion !== 'Check FAQ') setSearchQuery('');
    };

    const filteredArticles = SUGGESTED_ARTICLES.filter(article =>
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (!isAuthenticated) return null;

    return (
        <>
            {!isOpen && (
                <div style={{ position: 'fixed', bottom: '24px', right: '24px', cursor: 'pointer' }} className="z-50">

                    <button
                        onClick={handleClick}
                        aria-label="Open Chat"
                        className="relative w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                        <MessageCircle className="w-10 h-10 mx-auto" />
                    </button>
                </div>
            )}

            {isOpen && (
                <div className="fixed bottom-8 right-6 z-50 animate-slide-in-up">
                    <ChatWindow
                        messages={messages}
                        isTyping={isTyping}
                        inputValue={inputValue}
                        setInputValue={setInputValue}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        selectedArticle={selectedArticle}
                        filteredArticles={filteredArticles}
                        isOnline={isOnline}
                        apiStatus={apiStatus}
                        messagesEndRef={messagesEndRef}
                        onSendMessage={handleSendMessage}
                        onSuggestionClick={handleSuggestionClick}
                        onArticleClick={(article) => { setSelectedArticle(article); setSearchQuery(''); }}
                        onBackToChat={() => { setSelectedArticle(null); setSearchQuery(''); }}
                        onClose={() => setIsOpen(false)}
                    />
                </div>
            )}
        </>
    );
};

export default HelpChatbot;