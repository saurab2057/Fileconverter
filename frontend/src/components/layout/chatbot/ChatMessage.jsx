// ChatMessage.jsx
import ReactMarkdown from 'react-markdown';

const markdownComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-1">{children}</ol>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-1">{children}</ul>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">
      {children}
    </a>
  ),
};

const ChatMessage = ({ message, onSuggestionClick }) => {
  return (
    <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[80%]">
        <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
          message.type === 'user'
            ? 'bg-blue-600 text-white rounded-br-md'
            : message.error
              ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-bl-md border border-red-200 dark:border-red-800'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md'
        } transition-colors duration-300`}>
          
          <ReactMarkdown components={markdownComponents}>
            {message.content}
          </ReactMarkdown>

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
    </div>
  );
};

export default ChatMessage;