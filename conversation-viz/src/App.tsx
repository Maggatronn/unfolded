import React, { useState, useEffect } from 'react';
import './App.css';
import ConversationViz from './components/ConversationViz';
import { ConversationsData } from './types/conversationTypes';

function App() {
  const [conversationsData, setConversationsData] = useState<ConversationsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/merged_conversations_oregon.json');
        
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        setConversationsData(data);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching conversation data:', err);
        setError(`Failed to load conversation data: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="loading-container" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '24px'
      }}>
        Loading conversation data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container" style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        color: 'red',
        padding: '20px'
      }}>
        <h2>Error</h2>
        <p>{error}</p>
        <p>Make sure the conversation data file is available in the public folder.</p>
      </div>
    );
  }

  if (!conversationsData) {
    return (
      <div className="no-data-container" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '24px'
      }}>
        No conversation data available.
      </div>
    );
  }

  return (
    <div className="App">
      <ConversationViz conversationsData={conversationsData} />
    </div>
  );
}

export default App;
