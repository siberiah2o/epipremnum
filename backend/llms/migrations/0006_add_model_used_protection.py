"""
添加 model_used 字段保护机制
"""
from django.db import migrations, connection


def add_model_used_protection_trigger(apps, schema_editor):
    """
    添加一个数据库触发器，防止 model_used 字段在特定条件下被意外覆盖
    """
    if connection.vendor == 'sqlite':
        # SQLite 触发器
        schema_editor.execute("""
            CREATE TRIGGER IF NOT EXISTS prevent_model_used_override
            BEFORE UPDATE ON llms_aianalysis
            WHEN NEW.model_used != OLD.model_used AND NEW.status = 'processing'
            BEGIN
                SELECT RAISE(ABORT, 'Cannot change model_used while task is processing');
            END;
        """)
        
        # 添加审计日志表
        schema_editor.execute("""
            CREATE TABLE IF NOT EXISTS llms_aianalysis_model_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                analysis_id INTEGER NOT NULL,
                old_model_name TEXT,
                new_model_name TEXT,
                change_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                change_reason TEXT,
                FOREIGN KEY (analysis_id) REFERENCES llms_aianalysis (id)
            );
        """)
        
        # 添加审计触发器
        schema_editor.execute("""
            CREATE TRIGGER IF NOT EXISTS audit_model_used_changes
            AFTER UPDATE OF model_used ON llms_aianalysis
            WHEN NEW.model_used != OLD.model_used
            BEGIN
                INSERT INTO llms_aianalysis_model_audit (analysis_id, old_model_name, new_model_name, change_reason)
                VALUES (NEW.id, OLD.model_used, NEW.model_used, 'Model name changed during task execution');
            END;
        """)
    elif connection.vendor == 'postgresql':
        # PostgreSQL 触发器
        schema_editor.execute("""
            CREATE OR REPLACE FUNCTION prevent_model_used_override()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.model_used IS DISTINCT FROM OLD.model_used AND NEW.status = 'processing' THEN
                    RAISE EXCEPTION 'Cannot change model_used while task is processing';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """)
        
        schema_editor.execute("""
            DROP TRIGGER IF EXISTS prevent_model_used_override_trigger ON llms_aianalysis;
            CREATE TRIGGER prevent_model_used_override_trigger
            BEFORE UPDATE ON llms_aianalysis
            FOR EACH ROW EXECUTE FUNCTION prevent_model_used_override();
        """)
        
        # 添加审计日志表
        schema_editor.execute("""
            CREATE TABLE IF NOT EXISTS llms_aianalysis_model_audit (
                id SERIAL PRIMARY KEY,
                analysis_id INTEGER NOT NULL REFERENCES llms_aianalysis(id),
                old_model_name TEXT,
                new_model_name TEXT,
                change_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                change_reason TEXT
            );
        """)
        
        # 添加审计触发器
        schema_editor.execute("""
            CREATE OR REPLACE FUNCTION audit_model_used_changes()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.model_used IS DISTINCT FROM OLD.model_used THEN
                    INSERT INTO llms_aianalysis_model_audit (analysis_id, old_model_name, new_model_name, change_reason)
                    VALUES (NEW.id, OLD.model_used, NEW.model_used, 'Model name changed during task execution');
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """)
        
        schema_editor.execute("""
            DROP TRIGGER IF EXISTS audit_model_used_changes_trigger ON llms_aianalysis;
            CREATE TRIGGER audit_model_used_changes_trigger
            AFTER UPDATE OF model_used ON llms_aianalysis
            FOR EACH ROW EXECUTE FUNCTION audit_model_used_changes();
        """)


def remove_model_used_protection_trigger(apps, schema_editor):
    """
    移除保护触发器
    """
    if connection.vendor == 'sqlite':
        schema_editor.execute("DROP TRIGGER IF EXISTS prevent_model_used_override")
        schema_editor.execute("DROP TRIGGER IF EXISTS audit_model_used_changes")
        schema_editor.execute("DROP TABLE IF EXISTS llms_aianalysis_model_audit")
    elif connection.vendor == 'postgresql':
        schema_editor.execute("DROP TRIGGER IF EXISTS prevent_model_used_override_trigger ON llms_aianalysis")
        schema_editor.execute("DROP FUNCTION IF EXISTS prevent_model_used_override()")
        schema_editor.execute("DROP TRIGGER IF EXISTS audit_model_used_changes_trigger ON llms_aianalysis")
        schema_editor.execute("DROP FUNCTION IF EXISTS audit_model_used_changes()")
        schema_editor.execute("DROP TABLE IF EXISTS llms_aianalysis_model_audit")


class Migration(migrations.Migration):

    dependencies = [
        ('llms', '0005_aianalysis_analysis_options'),
    ]

    operations = [
        migrations.RunPython(
            add_model_used_protection_trigger,
            remove_model_used_protection_trigger,
        ),
    ]