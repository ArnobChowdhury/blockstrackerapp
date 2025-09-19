import { API_URL } from '@env';

export const API_BASE_URL = `${API_URL}/api/v1`;

type HttpMethod = 'POST' | 'PUT';

interface EndpointConfig {
  method: HttpMethod;
  path: string;
}

type EntityEndpoints = {
  create: EndpointConfig;
  update: EndpointConfig;
};

export const apiEndpoints: Record<string, Partial<EntityEndpoints>> = {
  task: {
    create: { method: 'POST', path: '/tasks' },
    update: { method: 'PUT', path: '/tasks/:id' },
  },
  space: {
    create: { method: 'POST', path: '/spaces' },
    update: { method: 'PUT', path: '/spaces/:id' },
  },
  tag: {
    create: { method: 'POST', path: '/tags' },
    update: { method: 'PUT', path: '/tags/:id' },
  },
  repetitive_task_template: {
    create: { method: 'POST', path: '/repetitive-task-templates' },
    update: { method: 'PUT', path: '/repetitive-task-templates/:id' },
  },
};
