import React from 'react';
import { Send, X, ArrowLeft, Search, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import ChatMessage from './ChatMessage';

const ChatWindow = ({
    messages,
    isTyping,
    inputValue,
    setInputValue,
    searchQuery,
    setSearchQuery,
    selectedArticle,
    filteredArticles,
    isOnline,
    apiStatus,
    messagesEndRef,
    onSendMessage,
    onSuggestionClick,
    onArticleClick,
    onBackToChat,
    onClose,
}) => {

    const getStatusIcon = () => {
        if (!isOnline) return <WifiOff className="w-4 h-4 text-red-500" />;
        switch (apiStatus) {
            case 'connected': return <Wifi className="w-4 h-4 text-yellow-500" />;
            case 'error': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            default: return <div className="w-4 h-4 bg-gray-400 rounded-full animate-pulse" />;
        }
    };

    const getStatusText = () => {
        if (!isOnline) return 'Offline';
        switch (apiStatus) {
            case 'connected': return 'Active';
            case 'error': return 'Closed';
            default: return 'Connecting...';
        }
    };

    const renderContent = () => {
        if (selectedArticle) {
            return (
                <div className="flex-1 overflow-y-auto p-4">
                    <button onClick={onBackToChat} className="flex items-center text-blue-600 dark:text-blue-400 hover:underline mb-4 text-sm">
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Chat
                    </button>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{selectedArticle.title}</h4>
                    <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
                        {selectedArticle.content}
                    </div>
                </div>
            );
        } else if (searchQuery) {
            return (
                <div className="flex-1 overflow-y-auto p-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Suggested Articles</h4>
                    <div className="space-y-2">
                        {filteredArticles.map((article, index) => (
                            <button
                                key={index}
                                onClick={() => onArticleClick(article)}
                                className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
                            >
                                <h5 className="text-sm font-medium text-gray-900 dark:text-white">{article.title}</h5>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{article.description}</p>
                            </button>
                        ))}
                        {filteredArticles.length === 0 && (
                            <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-8">
                                No articles found matching "{searchQuery}"
                            </p>
                        )}
                    </div>
                </div>
            );
        } else {
            return (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((message) => (
                        <ChatMessage
                            key={message.id}
                            message={message}
                            onSuggestionClick={onSuggestionClick}
                        />
                    ))}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md p-3">
                                <div className="flex space-x-1">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            );
        }
    };

    return (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-4 sm:right-4 sm:w-96 sm:h-[520px] bg-white dark:bg-gray-900 sm:rounded-2xl shadow-2xl border-gray-200 dark:border-gray-700 sm:border flex flex-col z-50 transition-colors duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 sm:rounded-t-2xl flex items-center justify-between flex-shrink-0">
                <div>
                    <h3 className="font-semibold">Hi, How can we help?</h3>
                    <div className="flex items-center space-x-2 text-sm text-emerald-100 mt-1">
                        {getStatusIcon()}
                        <span>{getStatusText()}</span>
                    </div>
                </div>
                <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors duration-200">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Search Bar */}
            {!selectedArticle && (
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search for Articles..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors duration-300"
                        />
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-h-0">
                {renderContent()}
            </div>

            {/* Input Area */}
            {!selectedArticle && !searchQuery && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && onSendMessage()}
                            placeholder={isOnline ? "Ask me anything..." : "You're offline"}
                            disabled={!isOnline || apiStatus === 'error'}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <button
                            onClick={() => onSendMessage()}
                            disabled={!inputValue.trim() || !isOnline || apiStatus === 'error'}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white p-2 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Contact Support */}
            <div className="mt-auto p-3 text-center border-t border-gray-200 dark:border-gray-700">
                <button className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200">
                    Contact Support Team
                </button>
            </div>
        </div>
    );
};

export default ChatWindow;