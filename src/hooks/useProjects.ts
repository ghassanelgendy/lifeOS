/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Project, AcademicPaper, CreateInput, UpdateInput } from '../types/schema';

const PROJECTS_KEY = ['projects'];
const PAPERS_KEY = ['academic-papers'];

// Projects
export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: [...PROJECTS_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Project;
    },
    enabled: !!id,
  });
}

export function useProjectsByStatus(status: Project['status']) {
  return useQuery({
    queryKey: [...PROJECTS_KEY, 'status', status],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('status', status);
      if (error) throw error;
      return data as Project[];
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInput<Project>) => {
      const { data, error } = await supabase.from('projects').insert(input).select().single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput<Project> }) => {
      const { data: updated, error } = await supabase.from('projects').update(data).eq('id', id).select().single();
      if (error) throw error;
      return updated as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

// Academic Papers
export function usePapers() {
  return useQuery({
    queryKey: PAPERS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('academic_papers').select('*');
      if (error) throw error;
      return data as AcademicPaper[];
    },
  });
}

export function usePapersByProject(projectId: string) {
  return useQuery({
    queryKey: [...PAPERS_KEY, 'project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('academic_papers').select('*').eq('project_id', projectId);
      if (error) throw error;
      return data as AcademicPaper[];
    },
    enabled: !!projectId,
  });
}

export function usePaper(id: string) {
  return useQuery({
    queryKey: [...PAPERS_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase.from('academic_papers').select('*').eq('id', id).single();
      if (error) throw error;
      return data as AcademicPaper;
    },
    enabled: !!id,
  });
}

export function useCreatePaper() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInput<AcademicPaper>) => {
      const { data, error } = await supabase.from('academic_papers').insert(input).select().single();
      if (error) throw error;
      return data as AcademicPaper;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAPERS_KEY });
    },
  });
}

export function useUpdatePaper() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput<AcademicPaper> }) => {
      const { data: updated, error } = await supabase.from('academic_papers').update(data).eq('id', id).select().single();
      if (error) throw error;
      return updated as AcademicPaper;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAPERS_KEY });
    },
  });
}

export function useDeletePaper() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('academic_papers').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAPERS_KEY });
    },
  });
}
