import React, { useEffect, useState, useRef } from "react";
import type { FC } from "react";
import { Download, Upload, Trash2, Edit2, FolderPlus, FileText } from "lucide-react";

type FileItem = { name: string; size: number; modifiedAt?: string };

type Props = {
  apiBaseUrl: string;
  basePath?: string;
  downloadTargetFolder?: string;
  pollIntervalMs?: number | null;
};

const humanFileSize = (size: number) => {
  if (size === 0) return "0 B";
  const i = Math.floor(Math.log(size) / Math.log(1024));
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  return `${(size / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

const FileManager: FC<Props> = ({ apiBaseUrl, basePath = '/', downloadTargetFolder = '', pollIntervalMs = null }) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [newName, setNewName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/list?path=${encodeURIComponent(basePath)}`);
      if (!res.ok) throw new Error(`List failed: ${res.status} ${res.statusText}`);
      const json = await res.json();
      setFiles(json.files || []);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    if (pollIntervalMs && pollIntervalMs > 0) {
      const iv = setInterval(fetchList, pollIntervalMs);
      return () => clearInterval(iv);
    }
  }, [apiBaseUrl, basePath]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      Array.from(fileList).forEach((f) => fd.append('files', f));
      const res = await fetch(`${apiBaseUrl}/upload?path=${encodeURIComponent(basePath)}`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
      await fetchList();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) handleFiles(e.dataTransfer.files);
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();

    el.addEventListener('drop', onDrop as unknown as EventListener);
    el.addEventListener('dragover', onDragOver as unknown as EventListener);

    return () => {
      el.removeEventListener('drop', onDrop as unknown as EventListener);
      el.removeEventListener('dragover', onDragOver as unknown as EventListener);
    };
  }, []);

  const startRename = (file: FileItem) => {
    setRenameTarget(file);
    setNewName(file.name);
  };

  const doRename = async () => {
    if (!renameTarget) return;
    setLoading(true);
    setError(null);
    try {
      const body = { path: basePath, oldName: renameTarget.name, newName };
      const res = await fetch(`${apiBaseUrl}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Rename failed: ${res.status} ${res.statusText}`);
      setRenameTarget(null);
      await fetchList();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const doDelete = async (file: FileItem) => {
    const confirmed = typeof window !== 'undefined' ? window.confirm(`Delete ${file.name}? This cannot be undone.`) : true;
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: basePath, name: file.name }),
      });
      if (!res.ok) throw new Error(`Delete failed: ${res.status} ${res.statusText}`);
      await fetchList();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const doDownload = async (file: FileItem) => {
    setLoading(true);
    setError(null);
    try {
      const url = `${apiBaseUrl}/download?path=${encodeURIComponent(basePath.replace(/\/+$/,'') + '/' + file.name)}${downloadTargetFolder ? `&target=${encodeURIComponent(downloadTargetFolder)}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

      const contentType = res.headers.get('content-type') || '';
      const disposition = res.headers.get('content-disposition') || '';
      if (contentType.includes('application/octet-stream') || disposition.includes('attachment')) {
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
      } else {
        const json = await res.json();
        if (json && json.success) {
          if (typeof window !== 'undefined') window.alert(json.message || 'Download/copy initiated on server');
        } else {
          const blob = await res.blob();
          const href = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = href;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(href);
        }
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2"><FolderPlus size={18} /> File Manager</h2>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 cursor-pointer bg-gray-100 px-3 py-1 rounded-lg text-sm">
            <Upload size={16} />
            <span>Upload</span>
            <input ref={fileInputRef} onChange={onInputChange} type="file" className="hidden" multiple />
          </label>
          <button onClick={fetchList} className="px-3 py-1 rounded-lg bg-gray-100 text-sm">Refresh</button>
        </div>
      </div>

      <div ref={dropRef} className="border-2 border-dashed border-gray-200 rounded-lg p-4 mb-4 text-center">
        <div className="text-sm">Drag & drop files here to upload, or click <button  onClick={() => fileInputRef.current?.click()} className="underline">choose files</button></div>
      </div>

      {error && <div className="text-red-600 mb-2">{error}</div>}
      {loading && <div className="text-gray-500 mb-2">Working...</div>}
      {uploading && <div className="text-gray-500 mb-2">Uploading...</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-xs text-gray-500 border-b">
            <tr>
              <th className="py-2">Name</th>
              <th className="py-2">Size</th>
              <th className="py-2">Modified</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-center text-gray-500">No files</td></tr>
            )}
            {files.map((f) => (
              <tr key={f.name} className="border-b last:border-b-0">
                <td className="py-3 flex items-center gap-2">
                  <FileText size={16} />
                  <div className="truncate">{f.name}</div>
                </td>
                <td className="py-3">{humanFileSize(f.size)}</td>
                <td className="py-3">{f.modifiedAt ? new Date(f.modifiedAt).toLocaleString() : '-'}</td>
                <td className="py-3 flex gap-2">
                  <button title="Download" onClick={() => doDownload(f)} className="px-2 py-1 rounded hover:bg-gray-100">
                    <Download size={16} />
                  </button>
                  <button title="Rename" onClick={() => startRename(f)} className="px-2 py-1 rounded hover:bg-gray-100">
                    <Edit2 size={16} />
                  </button>
                  <button title="Delete" onClick={() => doDelete(f)} className="px-2 py-1 rounded hover:bg-gray-100">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {renameTarget && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg p-4 w-96 shadow-lg">
            <h3 className="font-semibold mb-2">Rename</h3>
            <div className="text-sm mb-3 text-gray-600">Renaming <strong>{renameTarget.name}</strong></div>
            <input className="w-full border rounded px-2 py-1 mb-3" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRenameTarget(null)} className="px-3 py-1 rounded">Cancel</button>
              <button onClick={doRename} className="px-3 py-1 rounded bg-blue-600 text-white">Save</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FileManager;
