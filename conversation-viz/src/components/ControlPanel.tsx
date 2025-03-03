import React from 'react';

interface ControlPanelProps {
  conversationIds: string[];
  selectedConversation: string;
  onConversationChange: (convoId: string) => void;
  facilitators: string[];
  selectedFacilitator: string;
  onFacilitatorChange: (facilitatorName: string) => void;
  hideFrontline: boolean;
  onHideFrontlineChange: (hide: boolean) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  conversationIds,
  selectedConversation,
  onConversationChange,
  facilitators,
  selectedFacilitator,
  onFacilitatorChange,
  hideFrontline,
  onHideFrontlineChange,
  onZoomIn,
  onZoomOut
}) => {
  return (
    <div className="control-panel" style={{
      padding: '10px',
      borderBottom: '1px solid #ccc',
      backgroundColor: '#f5f5f5',
      display: 'flex',
      alignItems: 'center',
      gap: '20px'
    }}>
      <div>
        <label htmlFor="conversation-selector" style={{ marginRight: '5px' }}>Conversation:</label>
        <select
          id="conversation-selector"
          value={selectedConversation}
          onChange={(e) => onConversationChange(e.target.value)}
          style={{ padding: '5px' }}
        >
          <option value="all">All Conversations</option>
          {conversationIds.map(id => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="facilitator-select" style={{ marginRight: '5px' }}>Facilitator:</label>
        <select
          id="facilitator-select"
          value={selectedFacilitator}
          onChange={(e) => onFacilitatorChange(e.target.value)}
          style={{ padding: '5px', width: '150px' }}
        >
          <option value="All Facilitators">All Facilitators</option>
          {facilitators.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      <div>
        <input
          type="checkbox"
          id="hide-frontline"
          checked={hideFrontline}
          onChange={(e) => onHideFrontlineChange(e.target.checked)}
          style={{ marginRight: '5px' }}
        />
        <label htmlFor="hide-frontline">Hide Documentary</label>
      </div>

      <div style={{ display: 'inline-block', marginLeft: '20px' }}>
        <button
          onClick={onZoomOut}
          style={{
            width: '30px',
            height: '30px',
            fontSize: '20px',
            cursor: 'pointer',
            borderRadius: '4px',
            border: '1px solid #ccc',
            background: 'white',
            marginRight: '5px'
          }}
        >
          −
        </button>
        <button
          onClick={onZoomIn}
          style={{
            width: '30px',
            height: '30px',
            fontSize: '20px',
            cursor: 'pointer',
            borderRadius: '4px',
            border: '1px solid #ccc',
            background: 'white'
          }}
        >
          +
        </button>
      </div>

      <div style={{
        padding: '5px',
        border: '1px solid #ccc',
        borderRadius: '4px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '5px',
          cursor: 'pointer'
        }}>
          <div style={{ width: '20px', marginRight: '8px' }}>
            <div style={{ height: '2px', background: 'black' }}></div>
          </div>
          <span>Substantive Response</span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer'
        }}>
          <div style={{ width: '20px', marginRight: '8px' }}>
            <svg width="20" height="2">
              <line x1="0" y1="1" x2="20" y2="1" stroke="black" strokeWidth="2" strokeDasharray="3,5"></line>
            </svg>
          </div>
          <span>Mechanical Response</span>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel; 