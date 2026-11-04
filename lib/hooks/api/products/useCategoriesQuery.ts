import apiClient from '@/lib/apiClient';
import { useQuery } from '@tanstack/react-query';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  _count?: {
    products: number;
  };
}

export const useCategoriesQuery = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await apiClient('/api/categories');
      const data = await response.json();
      return data.data; // { items: [], total: 0 }
    },
  });
};
