import { useProjects, usePapers } from './useProjects';

export function useAcademics() {
    const { data: projects = [] } = useProjects();
    const { data: papers = [] } = usePapers();

    return {
        projects,
        papers,
    };
}

export type { Project, AcademicPaper as Paper } from '../types/schema';
