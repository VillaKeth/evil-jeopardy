"""CLI entry point for the knowledge base.

Usage:
    python -m knowledge_base search "query"
    python -m knowledge_base search "query" --category bug_fix
    python -m knowledge_base list
    python -m knowledge_base list --category convention
    python -m knowledge_base stats
    python -m knowledge_base add --category lesson_learned --text "Something important"
    python -m knowledge_base show <point_id>
    python -m knowledge_base export --format md
    python -m knowledge_base migrate
"""

import argparse
import json
import sys

from . import store
from .categories import CATEGORIES


def cmd_search(args):
    query = " ".join(args.query)
    if not query.strip():
        print("Error: empty query")
        return

    if args.unified:
        results = store.unified_search(query, limit=args.limit or 10)
        if not results:
            print("No results found.")
            return
        if args.json:
            print(json.dumps(results, indent=2))
            return
        for r in results:
            print(f"\n{r['label']}")
            preview = r["text"][:300].replace("\n", " ")
            print(f"  {preview}")
    else:
        results = store.search(
            query=query,
            limit=args.limit,
            category=args.category,
        )
        if not results:
            print("No results found.")
            return
        if args.json:
            print(json.dumps(results, indent=2))
            return
        print(f"=== Knowledge Search: '{query}' ({len(results)} results) ===\n")
        for r in results:
            text = r["text"][:200] + "..." if len(r["text"]) > 200 else r["text"]
            print(f"  [{r['score']:.2f}] [{r['category']}] {text}")
            if r["tags"]:
                print(f"         tags: {', '.join(r['tags'])}")
            print()


def cmd_list(args):
    entries = store.list_entries(category=args.category, limit=args.limit)
    if not entries:
        print("No entries found.")
        return

    if args.json:
        print(json.dumps(entries, indent=2))
    else:
        cat_label = f" [{args.category}]" if args.category else ""
        print(f"=== Knowledge Entries{cat_label} ({len(entries)} shown) ===\n")
        for e in entries:
            text = e["text"][:150] + "..." if len(e["text"]) > 150 else e["text"]
            print(f"  [{e['category']}] (conf: {e['confidence']:.2f}, accessed: {e['access_count']}x)")
            print(f"    {text}\n")


def cmd_stats(args):
    s = store.stats()
    if args.json:
        print(json.dumps(s, indent=2))
    else:
        print("=== Knowledge Base Stats ===\n")
        if s.get("error"):
            print(f"  Error: {s['error']}")
            return

        print(f"  Collection: {s['collection']}")
        print(f"  Total entries: {s['total']}")
        print()
        if s.get("by_category"):
            print("  By category:")
            for cat, count in sorted(s["by_category"].items(), key=lambda x: -x[1]):
                print(f"    {cat}: {count}")
        print()
        if s.get("old_collections"):
            print("  Old collections (pre-migration):")
            for name, count in s["old_collections"].items():
                print(f"    {name}: {count} points")


def cmd_add(args):
    result = store.add(
        text=args.text,
        category=args.category,
        tags=args.tags.split(",") if args.tags else [],
        source="manual",
        confidence=1.0,
    )
    if result:
        print(f"Stored: [{args.category}] {args.text[:80]}")
    else:
        print("Failed to store entry.", file=sys.stderr)
        sys.exit(1)


def cmd_update(args):
    """Update an existing knowledge entry by ID."""
    result = store.update_entry(
        point_id=args.point_id,
        text=args.text,
        category=args.category,
        tags=args.tags.split(",") if args.tags else None,
    )
    if result:
        print(f"Updated: [{result['category']}] {result['text'][:80]}")
    else:
        print(f"Failed to update entry '{args.point_id}' (not found or error).", file=sys.stderr)
        sys.exit(1)


def cmd_delete(args):
    """Delete a knowledge entry by ID."""
    if not args.force:
        entries = store.list_entries(limit=10000)
        match = [e for e in entries if e.get("id") == args.point_id]
        if match:
            e = match[0]
            print(f"Deleting: [{e['category']}] {e['text'][:100]}...")
        else:
            print(f"Entry '{args.point_id}' not found.")
            sys.exit(1)

    success = store.delete_entry(args.point_id)
    if success:
        print(f"Deleted entry {args.point_id}")
    else:
        print(f"Failed to delete entry '{args.point_id}'.", file=sys.stderr)
        sys.exit(1)


def cmd_show(args):
    """Show a specific knowledge entry by ID."""
    entries = store.list_entries(limit=10000)
    match = [e for e in entries if e.get("id") == args.point_id]
    if not match:
        print(f"Entry '{args.point_id}' not found.")
        sys.exit(1)
    if args.json:
        print(json.dumps(match[0], indent=2))
    else:
        e = match[0]
        print(f"=== Knowledge Entry ===\n")
        print(f"  ID:         {e['id']}")
        print(f"  Category:   {e['category']}")
        print(f"  Confidence: {e.get('confidence', 'N/A')}")
        print(f"  Accessed:   {e.get('access_count', 0)}x")
        print(f"  Created:    {e.get('created_at', 'N/A')}")
        print(f"  Tags:       {', '.join(e.get('tags', []))}")
        print(f"\n  {e['text']}\n")


def cmd_export(args):
    entries = store.list_entries(limit=10000)
    if not entries:
        print("No entries to export.")
        return

    if args.format == "json":
        output = json.dumps(entries, indent=2)
    else:
        lines = [f"# Knowledge Base Export\n"]
        lines.append(f"**Total entries:** {len(entries)}\n")

        by_cat: dict[str, list] = {}
        for e in entries:
            cat = e.get("category", "unknown")
            by_cat.setdefault(cat, []).append(e)

        for cat in sorted(by_cat.keys()):
            lines.append(f"\n## {cat.replace('_', ' ').title()}\n")
            for e in by_cat[cat]:
                lines.append(f"- {e['text'][:300]}")
                if e.get("tags"):
                    lines.append(f"  *Tags: {', '.join(e['tags'])}*")
            lines.append("")

        output = "\n".join(lines)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"Exported {len(entries)} entries to {args.output}")
    else:
        print(output)


def cmd_migrate(args):
    print("Migrating old memory collections to knowledge collection...")
    result = store.migrate()
    if result.get("error"):
        print(f"Error: {result['error']}", file=sys.stderr)
        sys.exit(1)
    print(f"Migration complete:")
    print(f"  Migrated: {result.get('migrated', 0)}")
    print(f"  Skipped: {result.get('skipped', 0)}")
    print(f"  Duplicates: {result.get('duplicates', 0)}")
    print(f"  Errors: {result.get('errors', 0)}")


def cmd_ingest(args):
    """Ingest project documents into the documents collection."""
    from .ingestion import discover_files, compute_file_hash, load_file_hashes, save_file_hashes, detect_changes, chunk_file
    from .config import INGESTION_SOURCES, FILE_HASHES_PATH, PROJECT_ROOT
    import os

    project_root = PROJECT_ROOT

    if args.path:
        sources = [(args.path, "**/*")]
    else:
        sources = INGESTION_SOURCES

    all_files = discover_files(project_root, sources)
    print(f"Discovered {len(all_files)} files")

    current_hashes = {}
    for rel_path in all_files:
        abs_path = os.path.join(project_root, rel_path)
        if os.path.isfile(abs_path):
            current_hashes[rel_path] = compute_file_hash(abs_path)

    if args.changed:
        stored_hashes = load_file_hashes(FILE_HASHES_PATH)
        added, changed, removed = detect_changes(current_hashes, stored_hashes)
        files_to_process = added + changed
        print(f"Changes: {len(added)} added, {len(changed)} modified, {len(removed)} removed")

        for f in removed + changed:
            deleted = store.delete_document_chunks(f)
            if deleted:
                print(f"  Removed {deleted} chunks from {f}")
    else:
        files_to_process = list(current_hashes.keys())

    total_chunks = 0
    total_files = 0
    errors = 0
    for rel_path in files_to_process:
        chunks = chunk_file(project_root, rel_path)
        if not chunks:
            continue

        if not args.changed:
            store.delete_document_chunks(rel_path)

        file_chunks = 0
        for chunk in chunks:
            result = store.add_document_chunk(chunk.text, chunk.metadata)
            if result:
                file_chunks += 1
            else:
                errors += 1

        if file_chunks:
            total_files += 1
            total_chunks += file_chunks
            print(f"  {rel_path}: {file_chunks} chunks")

    save_file_hashes(current_hashes, FILE_HASHES_PATH)
    print(f"\nIngestion complete: {total_chunks} chunks from {total_files} files ({errors} errors)")


def cmd_browse(args):
    """Browse KB entries grouped by category."""
    EMOJI = {
        "architecture_decision": "[arch]",
        "bug_fix": "[bug]",
        "convention": "[conv]",
        "lesson_learned": "[learn]",
        "configuration": "[cfg]",
        "preference": "[pref]",
        "api_knowledge": "[api]",
        "troubleshooting": "[fix]",
    }

    for cat in CATEGORIES:
        entries = store.list_entries(category=cat, limit=100)
        if not entries:
            continue
        emoji = EMOJI.get(cat, "[?]")
        print(f"\n{emoji} {cat} ({len(entries)} entries)")
        for e in entries:
            text_preview = e["text"][:80].replace("\n", " ")
            print(f"  - {text_preview}...")


def cmd_docs(args):
    """Show document index inventory."""
    if getattr(args, 'tree', False):
        tree = store.list_document_tree()
        if args.json:
            print(json.dumps(tree, indent=2))
        else:
            print(f"=== Document Sources ({len(tree)} files) ===\n")
            for item in tree:
                print(f"  {item['source']} ({item['chunk_count']} chunks)")
        return

    if getattr(args, 'export', False):
        result = store.list_documents(
            file_path=getattr(args, 'file', None),
            cursor=getattr(args, 'cursor', None),
            limit=getattr(args, 'limit', 50),
        )
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"=== Document Chunks (showing {len(result['chunks'])} of {result['total']}) ===\n")
            for chunk in result['chunks']:
                text = chunk['text'][:120] + "..." if len(chunk['text']) > 120 else chunk['text']
                print(f"  [{chunk['source']}] chunk {chunk['chunk_index']}")
                print(f"    {text}\n")
        return

    if args.search:
        results = store.search_documents(args.search, limit=args.limit or 10)
        if not results:
            print("No matching document chunks found.")
            return
        for r in results:
            section = f" § {r['section_path']}" if r.get("section_path") else ""
            print(f"[{r['score']:.2f}] {r['file_path']}{section}")
            preview = r["text"][:200].replace("\n", " ")
            print(f"  {preview}\n")
        return

    ds = store.document_stats()
    if not ds["exists"] or ds["total_chunks"] == 0:
        print("No documents indexed. Run: python scripts/kb.py ingest")
        return

    dirs: dict[str, list[tuple[str, int]]] = {}
    for fp, count in sorted(ds["files"].items()):
        parts = fp.split("/")
        dir_key = parts[0] if len(parts) > 1 else "."
        if dir_key not in dirs:
            dirs[dir_key] = []
        dirs[dir_key].append((fp, count))

    total_files = len(ds["files"])
    print(f"Indexed Documents ({total_files} files, {ds['total_chunks']} chunks)")
    for dir_name, files in sorted(dirs.items()):
        dir_chunks = sum(c for _, c in files)
        print(f"+-- {dir_name}/ ({len(files)} files, {dir_chunks} chunks)")
        for fp, count in files[:5]:
            print(f"|   +-- {fp} ({count} chunks)")
        if len(files) > 5:
            print(f"|   +-- ... and {len(files) - 5} more files")


def cmd_status(args):
    """Show comprehensive KB dashboard."""
    from .config import EMBEDDING_MODEL, EMBEDDING_DIM, FILE_HASHES_PATH, PROJECT_ROOT
    from .ingestion import load_file_hashes
    import os

    kb_stats = store.stats()
    doc_stats = store.document_stats()
    hashes = load_file_hashes(FILE_HASHES_PATH)

    print("Knowledge Base Status")
    print(f"+-- Session Memory: {kb_stats.get('total', 0)} entries", end="")
    by_cat = kb_stats.get("by_category", {})
    if by_cat:
        parts = [f"{v} {k}" for k, v in sorted(by_cat.items()) if v > 0]
        print(f" ({', '.join(parts)})")
    else:
        print()

    if doc_stats["exists"]:
        print(f"+-- Documents: {doc_stats['total_chunks']} chunks from {len(doc_stats['files'])} files")
    else:
        print("+-- Documents: not indexed (run: python scripts/kb.py ingest)")

    print(f"+-- Embedding Model: {EMBEDDING_MODEL} ({EMBEDDING_DIM}-dim)")
    print(f"+-- Tracked Files: {len(hashes)}")

    project_root = PROJECT_ROOT
    stale = 0
    for rel_path, stored_hash in hashes.items():
        abs_path = os.path.join(project_root, rel_path)
        if os.path.isfile(abs_path):
            from .ingestion import compute_file_hash
            if compute_file_hash(abs_path) != stored_hash:
                stale += 1
    if stale:
        print(f"+-- Stale Files: {stale} (changed since last index)")
    else:
        print("+-- Stale Files: 0 (up to date)")

    qdrant_path = os.path.join(project_root, "qdrant.db")
    if os.path.isdir(qdrant_path):
        total_size = sum(
            os.path.getsize(os.path.join(dp, f))
            for dp, _, filenames in os.walk(qdrant_path)
            for f in filenames
        )
        size_mb = total_size / (1024 * 1024)
        print(f"+-- Storage: {size_mb:.1f} MB")


def main():
    parser = argparse.ArgumentParser(
        prog="knowledge_base",
        description="Knowledge Base CLI",
    )
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    sub = parser.add_subparsers(dest="command", required=True)

    # search
    p_search = sub.add_parser("search", help="Search knowledge semantically")
    p_search.add_argument("query", nargs="+", help="Search query")
    p_search.add_argument("--category", choices=CATEGORIES, help="Filter by category")
    p_search.add_argument("--limit", type=int, default=5, help="Max results")
    p_search.add_argument("--unified", "-u", action="store_true", help="Search both KB and documents")

    # list
    p_list = sub.add_parser("list", help="List knowledge entries")
    p_list.add_argument("--category", choices=CATEGORIES, help="Filter by category")
    p_list.add_argument("--limit", type=int, default=50, help="Max entries")

    # stats
    sub.add_parser("stats", help="Show knowledge base statistics")

    # add
    p_add = sub.add_parser("add", help="Add a knowledge entry manually")
    p_add.add_argument("--text", required=True, help="Knowledge text")
    p_add.add_argument("--category", required=True, choices=CATEGORIES, help="Category")
    p_add.add_argument("--tags", help="Comma-separated tags")

    # update
    p_update = sub.add_parser("update", help="Update an existing entry by ID")
    p_update.add_argument("point_id", help="Point ID to update")
    p_update.add_argument("--text", help="New text (re-embeds if changed)")
    p_update.add_argument("--category", choices=CATEGORIES, help="New category")
    p_update.add_argument("--tags", help="New comma-separated tags (replaces existing)")

    # delete
    p_delete = sub.add_parser("delete", help="Delete a knowledge entry by ID")
    p_delete.add_argument("point_id", help="Point ID to delete")
    p_delete.add_argument("--force", action="store_true", help="Skip confirmation display")

    # show
    p_show = sub.add_parser("show", help="Show a specific entry by ID")
    p_show.add_argument("point_id", help="Point ID to look up")

    # export
    p_export = sub.add_parser("export", help="Export knowledge base")
    p_export.add_argument("--format", choices=["md", "json"], default="md")
    p_export.add_argument("--output", help="Output file path")

    # migrate
    sub.add_parser("migrate", help="Migrate old memory collections")

    # ingest
    p_ingest = sub.add_parser("ingest", help="Ingest project documents")
    p_ingest.add_argument("--changed", action="store_true", help="Only re-index changed files")
    p_ingest.add_argument("--path", type=str, help="Index specific path only")

    # browse
    sub.add_parser("browse", help="Browse KB entries by category")

    # docs
    p_docs = sub.add_parser("docs", help="Show indexed document inventory")
    p_docs.add_argument("--search", type=str, help="Search within document chunks")
    p_docs.add_argument("--limit", type=int, default=10, help="Max results for search")
    p_docs.add_argument("--export", action="store_true", help="Export document chunks as JSON")
    p_docs.add_argument("--cursor", type=str, default=None, help="Pagination cursor")
    p_docs.add_argument("--file", type=str, default=None, help="Filter by source file path")
    p_docs.add_argument("--tree", action="store_true", help="Show file tree")

    # status
    sub.add_parser("status", help="Show KB dashboard")

    args = parser.parse_args()

    commands = {
        "search": cmd_search,
        "list": cmd_list,
        "stats": cmd_stats,
        "add": cmd_add,
        "update": cmd_update,
        "delete": cmd_delete,
        "show": cmd_show,
        "export": cmd_export,
        "migrate": cmd_migrate,
        "ingest": cmd_ingest,
        "browse": cmd_browse,
        "docs": cmd_docs,
        "status": cmd_status,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
