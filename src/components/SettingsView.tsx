import React, { useState } from "react";
import { 
  Lock, 
  Trash2, 
  AlertTriangle, 
  User, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Database,
  UserX
} from "lucide-react";
import { CatalogMetadata, AnalysisHistoryItem } from "../types";
import { 
  deleteCatalogItemsDB, 
  setCatalogsListDB, 
  setActiveCatalogIdDB, 
  setCatalogItemsDB 
} from "../utils/db";

interface SettingsViewProps {
  currentUser: string | null;
  onLogout: () => void;
  catalogs: CatalogMetadata[];
  setCatalogs: React.Dispatch<React.SetStateAction<CatalogMetadata[]>>;
  activeCatalogId: string;
  setActiveCatalogId: React.Dispatch<React.SetStateAction<string>>;
  setCatalogHistory: React.Dispatch<React.SetStateAction<AnalysisHistoryItem[]>>;
  onOpenAuthModal: () => void;
}

export default function SettingsView({
  currentUser,
  onLogout,
  catalogs,
  setCatalogs,
  activeCatalogId,
  setActiveCatalogId,
  setCatalogHistory,
  onOpenAuthModal
}: SettingsViewProps) {
  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Deletion state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const [deletionSuccess, setDeletionSuccess] = useState<string | null>(null);
  
  // Custom double confirmation modals/inline triggers
  const [confirmStage, setConfirmStage] = useState<{
    type: "local-wipe" | "data-only" | "account" | null;
    step: 0 | 1 | 2; // 0 = none, 1 = first warning, 2 = typed verification
  }>({ type: null, step: 0 });

  const [typedVerification, setTypedVerification] = useState("");

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError("Password must be at least 4 characters long.");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Header": currentUser || ""
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to change password.");
      }

      setPasswordSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "An unexpected error occurred.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleWipeLocalData = async () => {
    setIsDeleting(true);
    setDeletionError(null);
    try {
      // 1. Delete all catalog items in IndexedDB
      for (const cat of catalogs) {
        await deleteCatalogItemsDB(cat.id);
      }
      
      // 2. Set default blank catalogue structure in IndexedDB
      const defaultCatalog: CatalogMetadata = {
        id: "default",
        name: "Default Catalogue",
        timestamp: new Date().toISOString()
      };
      
      const newCatalogsList = [defaultCatalog];
      await setCatalogsListDB(newCatalogsList);
      await setActiveCatalogIdDB("default");
      await setCatalogItemsDB("default", []);

      // 3. Update parent component states
      setCatalogs(newCatalogsList);
      setActiveCatalogId("default");
      setCatalogHistory([]);

      setDeletionSuccess("All local database records wiped successfully.");
      setConfirmStage({ type: null, step: 0 });
      setTypedVerification("");
    } catch (err: any) {
      setDeletionError(err.message || "Failed to wipe local data.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleServerWipe = async (deleteType: "data-only" | "account") => {
    setIsDeleting(true);
    setDeletionError(null);
    try {
      const res = await fetch("/api/user/delete-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Header": currentUser || ""
        },
        body: JSON.stringify({ deleteType })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete data.");
      }

      if (deleteType === "data-only") {
        // Reset states to defaults matching backend initial default
        const defaultCatalog: CatalogMetadata = {
          id: "default",
          name: "Default Catalogue",
          timestamp: new Date().toISOString()
        };
        setCatalogs([defaultCatalog]);
        setActiveCatalogId("default");
        setCatalogHistory([]);

        // Sync with local DB
        await setCatalogsListDB([defaultCatalog]);
        await setActiveCatalogIdDB("default");
        await setCatalogItemsDB("default", []);

        setDeletionSuccess("All remote and local appraisal catalogues wiped successfully.");
      } else {
        // Account deletion
        setDeletionSuccess("Account and records deleted. Logging out...");
        setTimeout(() => {
          onLogout();
        }, 1500);
      }

      setConfirmStage({ type: null, step: 0 });
      setTypedVerification("");
    } catch (err: any) {
      setDeletionError(err.message || "Failed to execute server-side data purge.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-4xl mx-auto pb-12">
      {/* Page Header */}
      <div className="text-center space-y-2.5">
        <span className="inline-flex bg-rosebery-cream-bg border border-rosebery-border px-3.5 py-1.5 rounded-sm text-xs font-serif text-rosebery-primary font-medium tracking-wide italic">
          Privacy Controls & Credentials Setup
        </span>
        <h2 className="text-2xl md:text-3xl font-serif font-semibold text-rosebery-charcoal tracking-wide">
          System Settings & Data Management
        </h2>
        <p className="text-xs md:text-sm text-rosebery-muted max-w-xl mx-auto leading-relaxed">
          Manage your appraisal account passwords, clear session archives, or permanently purge stored prints from database collections.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Side: General Profile Card or Password Form */}
        <div className="md:col-span-6 space-y-6">
          {currentUser ? (
            <div className="bg-rosebery-card border border-rosebery-border rounded-sm p-6 shadow-gallery-soft space-y-5">
              <div className="border-b border-rosebery-border pb-3.5">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-rosebery-gold" />
                  <h3 className="text-md font-serif text-rosebery-charcoal font-semibold">
                    Change Password
                  </h3>
                </div>
                <p className="text-[10px] text-rosebery-muted mt-0.5">
                  Update the credentials used to access your dealer cloud account.
                </p>
              </div>

              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-sm flex items-center gap-2 animate-fadeIn">
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-sm flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-600" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-rosebery-primary font-semibold block">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-stone-50 border border-rosebery-border rounded-sm px-3 py-2 text-xs focus:outline-none focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/25"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-rosebery-primary font-semibold block">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-stone-50 border border-rosebery-border rounded-sm px-3 py-2 text-xs focus:outline-none focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/25"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-rosebery-primary font-semibold block">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Retype new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-stone-50 border border-rosebery-border rounded-sm px-3 py-2 text-xs focus:outline-none focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/25"
                  />
                </div>

                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full bg-rosebery-primary hover:bg-rosebery-primary-hover disabled:bg-stone-300 text-white font-mono text-[11px] font-bold uppercase tracking-wider py-3 rounded-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-200"
                >
                  {passwordLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Update Credentials
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-rosebery-card border border-rosebery-border rounded-sm p-6 shadow-gallery-soft space-y-6">
              <div className="border-b border-rosebery-border pb-3.5 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <User className="w-4 h-4 text-rosebery-gold" />
                  <h3 className="text-md font-serif text-rosebery-charcoal font-semibold">
                    Guest Account Profile
                  </h3>
                </div>
                <p className="text-[10px] text-rosebery-muted mt-0.5">
                  Offline storage active on this device.
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-rosebery-text-normal leading-relaxed">
                  You are currently using the app as a <strong>Guest</strong>. Appraisals, lots, and catalogues are stored entirely in your local browser's IndexedDB sandbox.
                </p>
                
                <div className="bg-rosebery-sage border border-rosebery-sage-border rounded-sm p-4 text-xs text-rosebery-text-normal space-y-2 leading-relaxed">
                  <p className="font-semibold text-rosebery-primary font-serif">Upgrade to Member Cloud Accounts to:</p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-rosebery-muted">
                    <li>Securely access your catalogues from multiple devices</li>
                    <li>Synchronize high-resolution scans and reports on the server</li>
                    <li>Avoid accidental deletion when clearing browser caches</li>
                  </ul>
                </div>

                <button
                  onClick={onOpenAuthModal}
                  className="w-full bg-rosebery-primary hover:bg-rosebery-primary-hover text-white font-mono text-[11px] font-bold uppercase tracking-wider py-3 rounded-xs cursor-pointer transition-colors duration-200"
                >
                  Log In / Create Account
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Data Privacy and Deletion Cards */}
        <div className="md:col-span-6 space-y-6">
          <div className="bg-rosebery-card border border-rosebery-border rounded-sm p-6 shadow-gallery-soft space-y-6">
            <div className="border-b border-rosebery-border pb-3.5">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-rosebery-gold" />
                <h3 className="text-md font-serif text-rosebery-charcoal font-semibold">
                  Privacy & Data Deletion
                </h3>
              </div>
              <p className="text-[10px] text-rosebery-muted mt-0.5">
                Purge your database entries or completely remove your profile record.
              </p>
            </div>

            {deletionError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-sm flex items-center gap-2">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <span>{deletionError}</span>
              </div>
            )}

            {deletionSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-600" />
                <span>{deletionSuccess}</span>
              </div>
            )}

            {confirmStage.type === null ? (
              <div className="space-y-4">
                {!currentUser ? (
                  // Guest delete options
                  <div className="space-y-4">
                    <p className="text-xs text-rosebery-text-normal leading-relaxed">
                      Wiping offline data deletes all catalogues and appraisal histories stored inside this browser's local sandbox.
                    </p>
                    
                    <button
                      onClick={() => setConfirmStage({ type: "local-wipe", step: 1 })}
                      className="w-full border border-red-200 hover:border-red-300 bg-red-50/50 hover:bg-red-50 text-red-800 font-mono text-[11px] font-bold uppercase tracking-wider py-3 rounded-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Wipe Local Offline Data
                    </button>
                  </div>
                ) : (
                  // Logged-in user delete options
                  <div className="space-y-4">
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-sm flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-[11px] space-y-1">
                        <p className="font-semibold font-serif">UK Data Privacy Notice</p>
                        <p className="text-amber-800 leading-normal">
                          In compliance with the UK GDPR and Data Protection Act 2018, you have the right to request deletion of your personal data. Wiping data clears all catalogues, reports, and scan files.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 space-y-3">
                      <div>
                        <p className="text-[11px] text-rosebery-muted mb-2 leading-relaxed">
                          Option 1: Reset and clear all appraisal scan items, uploaded photographs, and catalogues. Your user account remains active.
                        </p>
                        <button
                          onClick={() => setConfirmStage({ type: "data-only", step: 1 })}
                          className="w-full border border-red-200 hover:border-red-300 bg-red-50/50 hover:bg-red-50 text-red-800 font-mono text-[11px] font-bold uppercase tracking-wider py-3 rounded-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Clear Appraisal Data
                        </button>
                      </div>

                      <div className="pt-3 border-t border-rosebery-border/60">
                        <p className="text-[11px] text-rosebery-muted mb-2 leading-relaxed">
                          Option 2: Delete your account profile entirely, removing all authentication credentials and database records from our servers.
                        </p>
                        <button
                          onClick={() => setConfirmStage({ type: "account", step: 1 })}
                          className="w-full bg-red-800 hover:bg-red-900 text-white font-mono text-[11px] font-bold uppercase tracking-wider py-3 rounded-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-200 shadow-sm"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          Delete Account & Data
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Premium Double Confirmation Form UI
              <div className="bg-red-50/30 border border-red-200/80 rounded-sm p-4 space-y-4 animate-fadeIn">
                <div className="flex items-start gap-2.5 text-red-800">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold uppercase font-mono tracking-wider">
                      Destructive Action Warning
                    </h4>
                    <p className="text-[11px] leading-relaxed">
                      {confirmStage.type === "local-wipe" && 
                        "This will wipe all local IndexedDB records. You will lose access to all offline catalogs created on this browser. This cannot be undone."}
                      {confirmStage.type === "data-only" && 
                        "This will permanently delete all catalogs and uploads from the cloud. Your credentials will remain active, but your appraisal history will be fully wiped."}
                      {confirmStage.type === "account" && 
                        "This is a complete account purge. All folders, catalogues, photos, and authorization credentials will be completely and permanently removed."}
                    </p>
                  </div>
                </div>

                {confirmStage.step === 1 ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmStage(prev => ({ ...prev, step: 2 }))}
                      className="flex-1 bg-red-700 hover:bg-red-800 text-white text-[10px] font-mono uppercase font-bold py-2 rounded-xs transition-colors cursor-pointer"
                    >
                      I Understand, Continue
                    </button>
                    <button
                      onClick={() => {
                        setConfirmStage({ type: null, step: 0 });
                        setTypedVerification("");
                      }}
                      className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-mono uppercase font-bold py-2 rounded-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-red-800 font-bold block">
                        Type <span className="underline select-all">DELETE</span> to confirm
                      </label>
                      <input
                        type="text"
                        placeholder="Type DELETE"
                        value={typedVerification}
                        onChange={(e) => setTypedVerification(e.target.value)}
                        className="w-full bg-white border border-red-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/25"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (confirmStage.type === "local-wipe") {
                            handleWipeLocalData();
                          } else if (confirmStage.type === "data-only") {
                            handleServerWipe("data-only");
                          } else if (confirmStage.type === "account") {
                            handleServerWipe("account");
                          }
                        }}
                        disabled={typedVerification !== "DELETE" || isDeleting}
                        className="flex-1 bg-red-700 hover:bg-red-800 disabled:bg-stone-200 text-white disabled:text-stone-400 text-[10px] font-mono uppercase font-bold py-2 rounded-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                        Confirm Purge
                      </button>
                      <button
                        onClick={() => {
                          setConfirmStage({ type: null, step: 0 });
                          setTypedVerification("");
                        }}
                        className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-mono uppercase font-bold py-2 rounded-xs transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
