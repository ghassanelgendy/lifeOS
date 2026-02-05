import { useState } from 'react';
import {
  Plus,
  BookOpen,
  Award,
  Code,
  Edit2,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  FileText,
  CheckCircle,
  Pause
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  usePapers,
  useCreatePaper,
  useUpdatePaper,
  useDeletePaper
} from '../hooks/useProjects';
import { Modal, Button, Input, Select, TextArea } from '../components/ui';
import type { Project, AcademicPaper, CreateInput, ProjectType, ProjectStatus, PaperMethodology, PaperStatus } from '../types/schema';

const PROJECT_TYPE_ICONS: Record<ProjectType, React.ElementType> = {
  Thesis: BookOpen,
  Certification: Award,
  Coding: Code,
};

const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  Active: 'bg-green-500/20 text-green-400',
  Paused: 'bg-amber-500/20 text-amber-400',
  Done: 'bg-blue-500/20 text-blue-400',
};

const PAPER_STATUS_COLORS: Record<PaperStatus, string> = {
  Unread: 'bg-gray-500/20 text-gray-400',
  Reading: 'bg-amber-500/20 text-amber-400',
  Read: 'bg-green-500/20 text-green-400',
  Reviewed: 'bg-blue-500/20 text-blue-400',
};

export default function Academics() {
  const { data: projects = [], isLoading } = useProjects();
  const { data: allPapers = [] } = usePapers();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createPaper = useCreatePaper();
  const updatePaper = useUpdatePaper();
  const deletePaper = useDeletePaper();

  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isPaperModalOpen, setIsPaperModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingPaper, setEditingPaper] = useState<AcademicPaper | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const [projectForm, setProjectForm] = useState<Partial<CreateInput<Project>>>({
    title: '',
    type: 'Thesis',
    status: 'Active',
    description: '',
    target_date: '',
  });

  const [paperForm, setPaperForm] = useState<Partial<CreateInput<AcademicPaper>>>({
    project_id: '',
    title: '',
    methodology: 'Other',
    status: 'Unread',
    year: new Date().getFullYear(),
    key_finding: '',
    notes: '',
    url: '',
  });

  // Project Modal Handlers
  const handleOpenProjectModal = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setProjectForm({
        title: project.title,
        type: project.type,
        status: project.status,
        description: project.description,
        target_date: project.target_date?.split('T')[0] || '',
      });
    } else {
      setEditingProject(null);
      setProjectForm({
        title: '',
        type: 'Thesis',
        status: 'Active',
        description: '',
        target_date: '',
      });
    }
    setIsProjectModalOpen(true);
  };

  const handleSubmitProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProject) {
      updateProject.mutate({
        id: editingProject.id,
        data: projectForm,
      }, {
        onSuccess: () => setIsProjectModalOpen(false),
      });
    } else {
      createProject.mutate(projectForm as CreateInput<Project>, {
        onSuccess: () => setIsProjectModalOpen(false),
      });
    }
  };

  const handleDeleteProject = (id: string) => {
    if (confirm('Delete this project and all its papers?')) {
      deleteProject.mutate(id);
    }
  };

  // Paper Modal Handlers
  const handleOpenPaperModal = (projectId: string, paper?: AcademicPaper) => {
    setSelectedProjectId(projectId);
    if (paper) {
      setEditingPaper(paper);
      setPaperForm({
        project_id: paper.project_id,
        title: paper.title,
        authors: paper.authors,
        methodology: paper.methodology,
        status: paper.status,
        year: paper.year,
        key_finding: paper.key_finding,
        notes: paper.notes,
        url: paper.url,
      });
    } else {
      setEditingPaper(null);
      setPaperForm({
        project_id: projectId,
        title: '',
        methodology: 'Other',
        status: 'Unread',
        year: new Date().getFullYear(),
        key_finding: '',
        notes: '',
        url: '',
      });
    }
    setIsPaperModalOpen(true);
  };

  const handleSubmitPaper = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPaper) {
      updatePaper.mutate({
        id: editingPaper.id,
        data: paperForm,
      }, {
        onSuccess: () => setIsPaperModalOpen(false),
      });
    } else {
      createPaper.mutate({ ...paperForm, project_id: selectedProjectId } as CreateInput<AcademicPaper>, {
        onSuccess: () => setIsPaperModalOpen(false),
      });
    }
  };

  const handleDeletePaper = (id: string) => {
    if (confirm('Delete this paper?')) {
      deletePaper.mutate(id);
    }
  };

  // Get papers for a specific project
  const getProjectPapers = (projectId: string) => {
    return allPapers.filter(p => p.project_id === projectId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Academic & Career</h1>
          <p className="text-muted-foreground">Manage your thesis, certifications, and projects</p>
        </div>
        <Button onClick={() => handleOpenProjectModal()}>
          <Plus size={18} />
          New Project
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle size={18} />
            <span className="text-sm font-medium">Active</span>
          </div>
          <p className="text-2xl font-bold mt-1">{projects.filter(p => p.status === 'Active').length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Pause size={18} />
            <span className="text-sm font-medium">Paused</span>
          </div>
          <p className="text-2xl font-bold mt-1">{projects.filter(p => p.status === 'Paused').length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText size={18} />
            <span className="text-sm font-medium">Papers</span>
          </div>
          <p className="text-2xl font-bold mt-1">{allPapers.length}</p>
        </div>
      </div>

      {/* Projects List */}
      <div className="space-y-4">
        {projects.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
            <h3 className="mt-4 text-lg font-semibold">No projects yet</h3>
            <p className="text-muted-foreground">Create your first project to get started</p>
          </div>
        ) : (
          projects.map((project) => {
            const Icon = PROJECT_TYPE_ICONS[project.type];
            const papers = getProjectPapers(project.id);
            const isExpanded = expandedProject === project.id;

            return (
              <div key={project.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Project Header */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-secondary/20 transition-colors"
                  onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                >
                  <div className="p-2 rounded-lg bg-secondary">
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{project.title}</h3>
                      <span className={cn("px-2 py-0.5 rounded text-xs font-medium", PROJECT_STATUS_COLORS[project.status])}>
                        {project.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{project.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {project.target_date && (
                      <span className="text-xs text-muted-foreground hidden md:block">
                        Due: {format(new Date(project.target_date), 'MMM d, yyyy')}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{papers.length} papers</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenProjectModal(project);
                      }}
                      className="p-1.5 rounded hover:bg-secondary transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      className="p-1.5 rounded hover:bg-destructive/20 text-destructive transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </div>

                {/* Expanded Content - Papers */}
                {isExpanded && (
                  <div className="border-t border-border p-4 bg-secondary/10">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium">Literature Review</h4>
                      <Button size="sm" variant="secondary" onClick={() => handleOpenPaperModal(project.id)}>
                        <Plus size={14} />
                        Add Paper
                      </Button>
                    </div>

                    {papers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No papers added yet
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-xs text-muted-foreground uppercase tracking-wider">
                            <tr className="border-b border-border">
                              <th className="px-3 py-2 text-left">Title</th>
                              <th className="px-3 py-2 text-left">Methodology</th>
                              <th className="px-3 py-2 text-left">Year</th>
                              <th className="px-3 py-2 text-left">Status</th>
                              <th className="px-3 py-2 text-left">Key Finding</th>
                              <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {papers.map((paper) => (
                              <tr key={paper.id} className="hover:bg-secondary/20 transition-colors">
                                <td className="px-3 py-2 font-medium max-w-[200px] truncate">
                                  {paper.url ? (
                                    <a
                                      href={paper.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 hover:text-blue-400"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {paper.title}
                                      <ExternalLink size={12} />
                                    </a>
                                  ) : (
                                    paper.title
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <span className="px-2 py-0.5 rounded bg-secondary text-xs">
                                    {paper.methodology}
                                  </span>
                                </td>
                                <td className="px-3 py-2 tabular-nums">{paper.year || '-'}</td>
                                <td className="px-3 py-2">
                                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium", PAPER_STATUS_COLORS[paper.status])}>
                                    {paper.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 max-w-[200px] truncate text-muted-foreground">
                                  {paper.key_finding || '-'}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex justify-end gap-1">
                                    <button
                                      onClick={() => handleOpenPaperModal(project.id, paper)}
                                      className="p-1 rounded hover:bg-secondary transition-colors"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleDeletePaper(paper.id)}
                                      className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Project Modal */}
      <Modal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        title={editingProject ? 'Edit Project' : 'New Project'}
      >
        <form onSubmit={handleSubmitProject} className="space-y-4">
          <Input
            label="Title"
            value={projectForm.title}
            onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
            placeholder="e.g., Supply Chain Optimization"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type"
              value={projectForm.type}
              onChange={(e) => setProjectForm({ ...projectForm, type: e.target.value as ProjectType })}
              options={[
                { value: 'Thesis', label: 'Thesis' },
                { value: 'Certification', label: 'Certification' },
                { value: 'Coding', label: 'Coding' },
              ]}
            />
            <Select
              label="Status"
              value={projectForm.status}
              onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value as ProjectStatus })}
              options={[
                { value: 'Active', label: 'Active' },
                { value: 'Paused', label: 'Paused' },
                { value: 'Done', label: 'Done' },
              ]}
            />
          </div>
          <Input
            label="Target Date"
            type="date"
            value={projectForm.target_date}
            onChange={(e) => setProjectForm({ ...projectForm, target_date: e.target.value })}
          />
          <TextArea
            label="Description"
            value={projectForm.description}
            onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
            placeholder="Brief description of the project..."
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsProjectModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createProject.isPending || updateProject.isPending}>
              {editingProject ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Paper Modal */}
      <Modal
        isOpen={isPaperModalOpen}
        onClose={() => setIsPaperModalOpen(false)}
        title={editingPaper ? 'Edit Paper' : 'Add Paper'}
      >
        <form onSubmit={handleSubmitPaper} className="space-y-4">
          <Input
            label="Paper Title"
            value={paperForm.title}
            onChange={(e) => setPaperForm({ ...paperForm, title: e.target.value })}
            placeholder="Full paper title"
            required
          />
          <Input
            label="Authors"
            value={paperForm.authors || ''}
            onChange={(e) => setPaperForm({ ...paperForm, authors: e.target.value })}
            placeholder="e.g., Smith et al."
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Methodology"
              value={paperForm.methodology}
              onChange={(e) => setPaperForm({ ...paperForm, methodology: e.target.value as PaperMethodology })}
              options={[
                { value: 'AHP', label: 'AHP' },
                { value: 'TOPSIS', label: 'TOPSIS' },
                { value: 'MCDM', label: 'MCDM' },
                { value: 'ML', label: 'Machine Learning' },
                { value: 'Simulation', label: 'Simulation' },
                { value: 'Other', label: 'Other' },
              ]}
            />
            <Select
              label="Status"
              value={paperForm.status}
              onChange={(e) => setPaperForm({ ...paperForm, status: e.target.value as PaperStatus })}
              options={[
                { value: 'Unread', label: 'Unread' },
                { value: 'Reading', label: 'Reading' },
                { value: 'Read', label: 'Read' },
                { value: 'Reviewed', label: 'Reviewed' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Year"
              type="number"
              value={paperForm.year}
              onChange={(e) => setPaperForm({ ...paperForm, year: parseInt(e.target.value) || undefined })}
              min={1900}
              max={2100}
            />
            <Input
              label="URL"
              type="url"
              value={paperForm.url || ''}
              onChange={(e) => setPaperForm({ ...paperForm, url: e.target.value })}
              placeholder="Link to paper"
            />
          </div>
          <TextArea
            label="Key Finding"
            value={paperForm.key_finding || ''}
            onChange={(e) => setPaperForm({ ...paperForm, key_finding: e.target.value })}
            placeholder="Main takeaway from this paper..."
          />
          <TextArea
            label="Notes"
            value={paperForm.notes || ''}
            onChange={(e) => setPaperForm({ ...paperForm, notes: e.target.value })}
            placeholder="Additional notes..."
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsPaperModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPaper.isPending || updatePaper.isPending}>
              {editingPaper ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
