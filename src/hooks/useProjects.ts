/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Project, AcademicPaper, CreateInput, UpdateInput } from '../types/schema';

const PROJECTS_KEY = ['projects'];
const PAPERS_KEY = ['academic-papers'];

// Projects
export function useProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...PROJECTS_KEY, user?.id],
    queryFn: async () => {
      const q = supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Project[];
    },
    enabled: !!user?.id,
  });
}

export function useProject(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...PROJECTS_KEY, id, user?.id],
    queryFn: async () => {
      const q = supabase.from('projects').select('*').eq('id', id);
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q.single();
      if (error) throw error;
      return data as Project;
    },
    enabled: !!id && !!user?.id,
  });
}

export function useProjectsByStatus(status: Project['status']) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...PROJECTS_KEY, 'status', status, user?.id],
    queryFn: async () => {
      const q = supabase.from('projects').select('*').eq('status', status);
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Project[];
    },
    enabled: !!user?.id,
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
  const { user } = useAuth();
  return useQuery({
    queryKey: [...PAPERS_KEY, user?.id],
    queryFn: async () => {
      // Papers are scoped by project ownership, so filter via projects
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', user?.id || '');
      if (projectsError) throw projectsError;
      const projectIds = projects?.map(p => p.id) || [];
      
      if (projectIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('academic_papers')
        .select('*')
        .in('project_id', projectIds);
      if (error) throw error;
      return data as AcademicPaper[];
    },
    enabled: !!user?.id,
  });
}

export function usePapersByProject(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...PAPERS_KEY, 'project', projectId, user?.id],
    queryFn: async () => {
      // First verify the project belongs to the user
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, user_id')
        .eq('id', projectId)
        .single();
      if (projectError) throw projectError;
      if (project?.user_id !== user?.id) {
        throw new Error('Project not found or access denied');
      }
      
      const { data, error } = await supabase.from('academic_papers').select('*').eq('project_id', projectId);
      if (error) throw error;
      return data as AcademicPaper[];
    },
    enabled: !!projectId && !!user?.id,
  });
}

export function usePaper(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...PAPERS_KEY, id, user?.id],
    queryFn: async () => {
      // Verify paper belongs to user via project ownership
      const { data: paper, error: paperError } = await supabase
        .from('academic_papers')
        .select('*, projects!inner(user_id)')
        .eq('id', id)
        .single();
      if (paperError) throw paperError;
      if ((paper as any).projects?.user_id !== user?.id) {
        throw new Error('Paper not found or access denied');
      }
      return paper as AcademicPaper;
    },
    enabled: !!id && !!user?.id,
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
