interface TeacherFormValues {
  nombre: string;
  apellido: string;
  correo: string;
  fotoUrl: string;
}

interface TeacherFormProps {
  values: TeacherFormValues;
  onChange: (values: TeacherFormValues) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function TeacherForm({
  values,
  onChange,
  onSave,
  onCancel,
}: TeacherFormProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-surface-500 mb-1">
          Nombre *
        </label>
        <input
          value={values.nombre}
          onChange={(e) => onChange({ ...values, nombre: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-surface-500 mb-1">
          Apellido *
        </label>
        <input
          value={values.apellido}
          onChange={(e) => onChange({ ...values, apellido: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-surface-500 mb-1">
          Correo
        </label>
        <input
          value={values.correo}
          onChange={(e) => onChange({ ...values, correo: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-surface-500 mb-1">
          Foto (URL)
        </label>
        <input
          value={values.fotoUrl}
          onChange={(e) => onChange({ ...values, fotoUrl: e.target.value })}
          placeholder="https://..."
          className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
        />
      </div>
      <div className="flex gap-3 mt-4">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium hover:bg-surface-50"
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          className="flex-1 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}