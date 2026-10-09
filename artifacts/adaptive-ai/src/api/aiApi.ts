import { apiRequest, apiUpload } from './client';

export interface ChatResponse {
  conversationId: string;
  message: {
    id: string;
    conversationId: string;
    role: 'assistant';
    content: string;
    createdAt: string;
  };
}

export interface ConversationSummary {
  id: string;
  userId: string;
  title?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: MessageItem[];
}

export interface McqAnalysisResult {
  id?: string | null;
  question: string | null;
  options: string[];
  answer: string | null;
  explanation: string | null;
  confidence: number;
}

export const aiApi = {
  async chat(message: string, conversationId?: string): Promise<ChatResponse> {
    return apiRequest<ChatResponse>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversationId }),
    });
  },

  async getConversations(): Promise<ConversationSummary[]> {
    return apiRequest<ConversationSummary[]>('/api/ai/conversations');
  },

  async createConversation(title?: string): Promise<ConversationSummary> {
    return apiRequest<ConversationSummary>('/api/ai/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },

  async getConversation(id: string): Promise<ConversationDetail> {
    return apiRequest<ConversationDetail>(`/api/ai/conversations/${id}`);
  },

  async deleteConversation(id: string): Promise<{ id: string }> {
    return apiRequest<{ id: string }>(`/api/ai/conversations/${id}`, {
      method: 'DELETE',
    });
  },

  async sendMessage(id: string, content: string): Promise<MessageItem> {
    return apiRequest<MessageItem>(`/api/ai/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async askMcq(
    imageUri: string,
    mimeType = 'image/jpeg',
    fileName = 'question.jpg',
  ): Promise<McqAnalysisResult> {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: mimeType,
      name: fileName,
    } as unknown as Blob);

    return apiUpload<McqAnalysisResult>('/api/ai/mcq', formData);
  },

  async explainText(content: string): Promise<{ answer: string }> {
    return apiRequest<{ answer: string }>('/api/ai/explain', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },
};
