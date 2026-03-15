const ChatMessage = ({ message, onSuggestionClick }) => {
    return (
        <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%]`}>
                <div className={`p-3 rounded-2xl ${
                    message.type === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : message.error
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-bl-md border border-red-200 dark:border-red-800'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md'
                    } transition-colors duration-300`}
                >
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content}
                    </div>
                </div>

                {/* Suggestions */}
                {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {message.suggestions.map((suggestion, index) => (
                            <button
                                key={index}
                                onClick={() => onSuggestionClick(suggestion)}
                                className="block w-full text-left p-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors duration-200"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatMessage;