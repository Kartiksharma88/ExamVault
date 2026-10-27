import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api-client';
import { KaTeXPreview } from '../components/KaTeXPreview';
import { DiffViewer } from '../components/DiffViewer';
import {
  Save,
  Send,
  ArrowLeft,
  Plus,
  Trash2,
  Image as ImageIcon,
  Eye,
  Edit3,
  History,
  AlertCircle,
  HelpCircle,
  FileCode,
} from 'lucide-react';

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Topic {
  id: string;
  subjectId: string;
  name: string;
}

interface Subtopic {
  id: string;
  topicId: string;
  name: string;
}

interface OptionItem {
  label: string;
  text: string;
}

interface QuestionEditorPageProps {
  questionId?: string | null;
  onBack: () => void;
  onSaved: () => void;
}

export const QuestionEditorPage: React.FC<QuestionEditorPageProps> = ({
  questionId,
  onBack,
  onSaved,
}) => {
  const isEditing = Boolean(questionId);

  // Syllabus state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);

  // Metadata form state
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [subtopicId, setSubtopicId] = useState('');
  const [questionType, setQuestionType] = useState<'MCQ_SINGLE' | 'MCQ_MULTI' | 'INTEGER'>('MCQ_SINGLE');
  const [difficulty, setDifficulty] = useState(0.5);
  const [cognitiveLevel, setCognitiveLevel] = useState('APPLY');
  const [marks, setMarks] = useState(4);
  const [negativeMarks, setNegativeMarks] = useState(1);
  const [estimatedTimeSeconds, setEstimatedTimeSeconds] = useState(120);
  const [language, setLanguage] = useState<'EN' | 'HI' | 'BILINGUAL'>('EN');

  // Content form state
  const [stem, setStem] = useState('');
  const [solution, setSolution] = useState('');
  const [options, setOptions] = useState<OptionItem[]>([
    { label: 'A', text: '' },
    { label: 'B', text: '' },
    { label: 'C', text: '' },
    { label: 'D', text: '' },
  ]);
  const [correctSingle, setCorrectSingle] = useState('A');
  const [correctMulti, setCorrectMulti] = useState<string[]>(['A']);
  const [correctInteger, setCorrectInteger] = useState<number>(0);
  const [tolerance, setTolerance] = useState<number>(0);

  // Images state (base64 or local blob preview)
  const [imageFiles, setImageFiles] = useState<{ id: string; name: string; url: string }[]>([]);

  // Status & Versions
  const [existingHumanId, setExistingHumanId] = useState<string>('');
  const [existingStatus, setExistingStatus] = useState<string>('DRAFT');
  const [existingVersion, setExistingVersion] = useState<number>(1);
  const [originalContent, setOriginalContent] = useState<string>('');
  const [showDiff, setShowDiff] = useState(false);

  // UI tabs & states
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch syllabus
  useEffect(() => {
    const fetchSyllabus = async () => {
      try {
        const subRes = await apiRequest<{ success: boolean; data: Subject[] }>('/syllabus/subjects');
        setSubjects(subRes.data || []);
        if (subRes.data && subRes.data.length > 0 && !subjectId) {
          setSubjectId(subRes.data[0].id);
        }

        const topRes = await apiRequest<{ success: boolean; data: Topic[] }>('/syllabus/topics');
        setTopics(topRes.data || []);

        const subtopRes = await apiRequest<{ success: boolean; data: Subtopic[] }>('/syllabus/subtopics');
        setSubtopics(subtopRes.data || []);
      } catch (err) {
        console.error('Failed to load syllabus data:', err);
      }
    };
    fetchSyllabus();
  }, []);

  // Fetch question if editing
  useEffect(() => {
    if (!questionId) return;

    const fetchQuestion = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiRequest<{
          success: boolean;
          data: {
            id: string;
            humanId: string;
            status: string;
            currentVersion: number;
            metadata: any;
            content: {
              type: string;
              stem: string;
              options?: OptionItem[];
              solution?: string;
              language: string;
            };
            answerKey: {
              type: string;
              correct: any;
              tolerance?: number;
            };
          };
        }>(`/questions/${questionId}/content`);

        const q = res.data;
        setExistingHumanId(q.humanId);
        setExistingStatus(q.status);
        setExistingVersion(q.currentVersion);

        // Metadata
        setSubjectId(q.metadata.subjectId || '');
        setTopicId(q.metadata.topicId || '');
        setSubtopicId(q.metadata.subtopicId || '');
        setQuestionType(q.metadata.type);
        setDifficulty(q.metadata.difficulty);
        setCognitiveLevel(q.metadata.cognitiveLevel);
        setMarks(q.metadata.marks);
        setNegativeMarks(q.metadata.negativeMarks || 0);
        setEstimatedTimeSeconds(q.metadata.estimatedTimeSeconds || 120);
        setLanguage(q.metadata.language || 'EN');

        // Content
        setStem(q.content.stem || '');
        setSolution(q.content.solution || '');
        setOriginalContent(q.content.stem || '');

        if (q.content.options && q.content.options.length > 0) {
          setOptions(q.content.options);
        }

        // Answer key
        if (q.answerKey.type === 'MCQ_SINGLE') {
          setCorrectSingle(String(q.answerKey.correct));
        } else if (q.answerKey.type === 'MCQ_MULTI') {
          setCorrectMulti(Array.isArray(q.answerKey.correct) ? q.answerKey.correct : [String(q.answerKey.correct)]);
        } else if (q.answerKey.type === 'INTEGER') {
          setCorrectInteger(Number(q.answerKey.correct));
          setTolerance(q.answerKey.tolerance || 0);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to decrypt question content');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestion();
  }, [questionId]);

  // Options helpers
  const handleAddOption = () => {
    if (options.length >= 8) return;
    const nextLabel = String.fromCharCode(65 + options.length);
    setOptions([...options, { label: nextLabel, text: '' }]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    const newOpts = options.filter((_, i) => i !== index).map((opt, i) => ({
      ...opt,
      label: String.fromCharCode(65 + i),
    }));
    setOptions(newOpts);
  };

  const handleOptionTextChange = (index: number, text: string) => {
    const updated = [...options];
    updated[index].text = text;
    setOptions(updated);
  };

  const toggleMultiCorrect = (label: string) => {
    if (correctMulti.includes(label)) {
      if (correctMulti.length > 1) {
        setCorrectMulti(correctMulti.filter((l) => l !== label));
      }
    } else {
      setCorrectMulti([...correctMulti, label]);
    }
  };

  // Image upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      alert('Only PNG and JPEG images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size exceeds 5MB limit.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const mockImageId = crypto.randomUUID();
    setImageFiles([...imageFiles, { id: mockImageId, name: file.name, url: previewUrl }]);
  };

  // Build payload
  const buildPayload = () => {
    let answerKey: any;
    if (questionType === 'MCQ_SINGLE') {
      answerKey = { type: 'MCQ_SINGLE', correct: correctSingle };
    } else if (questionType === 'MCQ_MULTI') {
      answerKey = { type: 'MCQ_MULTI', correct: correctMulti };
    } else {
      answerKey = { type: 'INTEGER', correct: Number(correctInteger), tolerance: Number(tolerance) };
    }

    const content: any = {
      type: questionType,
      stem,
      solution: solution || undefined,
      language,
    };

    if (questionType === 'MCQ_SINGLE' || questionType === 'MCQ_MULTI') {
      content.options = options;
    }

    if (imageFiles.length > 0) {
      content.imageIds = imageFiles.map((img) => img.id);
    }

    const metadata = {
      subjectId,
      topicId: topicId || undefined,
      subtopicId: subtopicId || undefined,
      type: questionType,
      difficulty: Number(difficulty),
      cognitiveLevel,
      marks: Number(marks),
      negativeMarks: Number(negativeMarks),
      estimatedTimeSeconds: Number(estimatedTimeSeconds),
      language,
    };

    return { content, answerKey, metadata };
  };

  // Save handler
  const handleSave = async (submitDirectly: boolean) => {
    if (!stem.trim()) {
      alert('Question stem is required');
      return;
    }
    if (!subjectId) {
      alert('Please select a subject');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      let targetId = questionId;

      if (isEditing && targetId) {
        await apiRequest(`/questions/${targetId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        const createRes = await apiRequest<{ success: boolean; data: { id: string } }>('/questions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        targetId = createRes.data.id;
      }

      if (submitDirectly && targetId) {
        await apiRequest(`/questions/${targetId}/submit`, { method: 'PATCH' });
      }

      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  const filteredTopics = topics.filter((t) => !subjectId || t.subjectId === subjectId);
  const filteredSubtopics = subtopics.filter((st) => !topicId || st.topicId === topicId);

  if (loading) {
    return (
      <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
        <div className="inline-block w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm text-slate-500">Retrieving & decrypting cryptographic question payload...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900">
                {isEditing ? `Edit Question: ${existingHumanId}` : 'Author New Exam Question'}
              </h1>
              {isEditing && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-semibold">
                  v{existingVersion} ({existingStatus})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Markdown + LaTeX supported with live KaTeX rendering & Devanagari Hindi text.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {isEditing && existingStatus === 'SUBMITTED' && (
            <button
              type="button"
              onClick={() => setShowDiff(!showDiff)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center space-x-1.5"
            >
              <History className="w-4 h-4 text-slate-500" />
              <span>{showDiff ? 'Hide Diff' : 'View Diff'}</span>
            </button>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(false)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 transition-colors flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-slate-500" />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-all flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isEditing && existingStatus === 'SUBMITTED' ? 'Submit New Version' : 'Submit Question'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-3 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Version Diff View if toggled */}
      {showDiff && (
        <div className="space-y-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <History className="w-4 h-4 text-red-600" />
            <span>Diff Against Version {existingVersion}</span>
          </h3>
          <DiffViewer
            oldText={originalContent}
            newText={stem}
            oldLabel={`Version ${existingVersion} (Submitted)`}
            newLabel="Current Edits (Unsaved)"
          />
        </div>
      )}

      {/* Grid: Left Meta + Right Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Metadata & Syllabus */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-5 h-fit">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">
            Question Taxonomy & Metadata
          </h2>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Subject *</label>
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setTopicId('');
                setSubtopicId('');
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Topic */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Topic</label>
            <select
              value={topicId}
              onChange={(e) => {
                setTopicId(e.target.value);
                setSubtopicId('');
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
            >
              <option value="">-- General Topic --</option>
              {filteredTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subtopic */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Subtopic</label>
            <select
              value={subtopicId}
              onChange={(e) => setSubtopicId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
            >
              <option value="">-- General Subtopic --</option>
              {filteredSubtopics.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          {/* Question Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Question Type *</label>
            <div className="grid grid-cols-3 gap-2">
              {(['MCQ_SINGLE', 'MCQ_MULTI', 'INTEGER'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setQuestionType(t)}
                  className={`py-2 px-1 text-center rounded-lg text-xs font-semibold transition-all ${
                    questionType === t
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Difficulty (0.0 – 1.0)</label>
              <span className="text-xs font-mono text-red-600 font-bold">{difficulty.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={difficulty}
              onChange={(e) => setDifficulty(parseFloat(e.target.value))}
              className="w-full accent-red-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>Easy (0.0)</span>
              <span>Medium (0.5)</span>
              <span>Hard (1.0)</span>
            </div>
          </div>

          {/* Cognitive Level (Bloom) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Cognitive Level (Bloom)</label>
            <select
              value={cognitiveLevel}
              onChange={(e) => setCognitiveLevel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
            >
              {['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'].map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          {/* Marks and Negative Marks */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Marks (+)</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={marks}
                onChange={(e) => setMarks(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-emerald-700 font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Penalty (-)</label>
              <input
                type="number"
                min="0"
                step="0.25"
                value={negativeMarks}
                onChange={(e) => setNegativeMarks(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-red-600 font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          {/* Estimated Time & Language */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Time (Seconds)</label>
              <input
                type="number"
                min="10"
                step="10"
                value={estimatedTimeSeconds}
                onChange={(e) => setEstimatedTimeSeconds(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
              >
                <option value="EN">English</option>
                <option value="HI">हिन्दी (Hindi)</option>
                <option value="BILINGUAL">Bilingual</option>
              </select>
            </div>
          </div>

          {/* Image Attachments */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center justify-between">
              <span>Encrypted Attachments</span>
              <span className="text-[10px] text-slate-500">Max 5MB</span>
            </label>

            <label className="w-full border border-dashed border-slate-300 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer hover:border-red-500 transition-colors bg-slate-50/50 hover:bg-red-50/20">
              <ImageIcon className="w-5 h-5 text-red-600 mb-1" />
              <span className="text-xs text-slate-600 font-medium">Click to upload diagram</span>
              <input type="file" accept="image/png,image/jpeg" onChange={handleImageUpload} className="hidden" />
            </label>

            {imageFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {imageFiles.map((img, idx) => (
                  <div key={img.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    <div className="flex items-center space-x-2 truncate">
                      <img src={img.url} alt="thumbnail" className="w-7 h-7 rounded object-cover border border-slate-200" />
                      <span className="truncate text-slate-700 font-medium">{img.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImageFiles(imageFiles.filter((_, i) => i !== idx))}
                      className="text-red-600 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 2 Columns: Stem, Options, KaTeX Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stem Editor with Live KaTeX Preview */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-red-600" />
                <h2 className="text-sm font-bold text-slate-900">Question Stem & Formulas</h2>
              </div>

              {/* View mode toggle */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'edit' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Editor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'preview' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>KaTeX Preview</span>
                </button>
              </div>
            </div>

            {activeTab === 'edit' ? (
              <div>
                <textarea
                  rows={8}
                  value={stem}
                  onChange={(e) => setStem(e.target.value)}
                  placeholder="Enter question text with LaTeX formulas, e.g.:&#10;Consider a projectile launched with velocity $v_0$ at angle $\theta$.&#10;The maximum height attained is given by:&#10;$$H = \frac{v_0^2 \sin^2 \theta}{2g}$$&#10;Devanagari text like: किसी प्रक्षेप्य का महत्तम परास ज्ञात कीजिए।"
                  className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 font-mono leading-relaxed resize-y"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Use <code className="text-red-600 font-bold">$...$</code> for inline equations and{' '}
                  <code className="text-red-600 font-bold">$$...$$</code> for centered display equations.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 min-h-[190px]">
                <KaTeXPreview content={stem} />
              </div>
            )}
          </div>

          {/* Options (For MCQ types) or Integer Answer */}
          {(questionType === 'MCQ_SINGLE' || questionType === 'MCQ_MULTI') && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Answer Options</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {questionType === 'MCQ_SINGLE'
                      ? 'Select one radio button to mark as the correct answer.'
                      : 'Check all checkboxes that represent correct options.'}
                  </p>
                </div>

                {options.length < 8 && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-red-600 border border-slate-200 shadow-2xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Option</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {options.map((opt, idx) => {
                  const isCorrect =
                    questionType === 'MCQ_SINGLE'
                      ? correctSingle === opt.label
                      : correctMulti.includes(opt.label);

                  return (
                    <div
                      key={opt.label}
                      className={`flex items-start space-x-3 p-3.5 rounded-xl border transition-all ${
                        isCorrect
                          ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300/50'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Radio or Checkbox */}
                      <button
                        type="button"
                        onClick={() => {
                          if (questionType === 'MCQ_SINGLE') {
                            setCorrectSingle(opt.label);
                          } else {
                            toggleMultiCorrect(opt.label);
                          }
                        }}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs font-mono transition-colors flex-shrink-0 mt-0.5 ${
                          isCorrect
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>

                      {/* Text Input */}
                      <div className="flex-1 space-y-1">
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                          placeholder={`Option ${opt.label} text or LaTeX formula, e.g. $\\frac{h}{2}$`}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-600"
                        />
                        {opt.text && opt.text.includes('$') && (
                          <div className="text-xs px-2.5 py-1.5 rounded bg-slate-50 border border-slate-200">
                            <KaTeXPreview content={opt.text} />
                          </div>
                        )}
                      </div>

                      {/* Delete option button */}
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg transition-colors flex-shrink-0"
                          title="Remove option"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* INTEGER Type Answer */}
          {questionType === 'INTEGER' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                Integer Numerical Answer
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Correct Value (Integer) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={correctInteger}
                    onChange={(e) => setCorrectInteger(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-emerald-700 font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tolerance (Default 0)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={tolerance}
                    onChange={(e) => setTolerance(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Optional Explanation / Solution */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <HelpCircle className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">Solution & Explanation (Optional)</h2>
            </div>
            <textarea
              rows={4}
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              placeholder="Step-by-step solution and derivation with formulas..."
              className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 font-mono leading-relaxed resize-y"
            />
            {solution && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Preview</span>
                <KaTeXPreview content={solution} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
