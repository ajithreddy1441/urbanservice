import api from '../services/api';

export async function downloadFile(url, filename, params) {
  const response = await api.get(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}
