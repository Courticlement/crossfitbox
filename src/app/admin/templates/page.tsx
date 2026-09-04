import { tenantPrisma } from "@/lib/prisma";
import { dayName } from "@/lib/dates";
import { requireOrgAdmin } from "@/lib/auth-context";
import { PrevWeekBanner } from "@/components/prev-week-banner";
import { TemplateFilters } from "@/components/template-filters";
import {
  SelectAllTemplatesCheckbox,
  SelectTemplateCheckbox,
  TemplateBulkAssignProvider,
} from "@/components/template-bulk-assign";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import {
  createTemplate,
  updateTemplates,
  toggleTemplateActive,
  deleteTemplate,
} from "@/lib/actions/templates";

const FIELD_CLASS =
  "w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-white hover:border-neutral-700 focus:border-neutral-500 focus:outline-none";

// All rows' editable fields share this one form (via the `form=` attribute,
// since a <form> can't literally wrap <tr>s without breaking each row's own
// Remove/Active-toggle forms) — one submit saves every edited row at once.
const BULK_FORM_ID = "templates-bulk-form";

export default async function ClassTemplatesPage({
  searchParams,
}: PageProps<"/admin/templates">) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const params = await searchParams;
  const dayOfWeekFilter = typeof params?.dayOfWeek === "string" ? params.dayOfWeek : "";
  const roomFilter = typeof params?.room === "string" ? params.room : "";
  const coachIdFilter = typeof params?.coachId === "string" ? params.coachId : "";
  const statusFilter = typeof params?.status === "string" ? params.status : "";

  const [templates, coaches, rooms] = await Promise.all([
    prisma.classTemplate.findMany({
      where: {
        ...(dayOfWeekFilter ? { dayOfWeek: Number(dayOfWeekFilter) } : {}),
        ...(roomFilter ? { roomId: roomFilter } : {}),
        ...(coachIdFilter === "none"
          ? { coachId: null }
          : coachIdFilter
            ? { coachId: coachIdFilter }
            : {}),
        ...(statusFilter ? { active: statusFilter === "active" } : {}),
      },
      include: { coach: true, room: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    prisma.room.findMany({
      where: { archived: false },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="text-neutral-300">
      <h1 className="mb-1 text-lg font-semibold text-white">
        Modèles de cours
      </h1>
      <PrevWeekBanner organizationId={organizationId} />
      <UnsavedChangesGuard formId={BULK_FORM_ID} />
      <p className="mb-4 text-sm text-neutral-500">
        L&apos;emploi du temps hebdomadaire récurrent de la box. Utilisé pour
        générer les cours de chaque semaine sur la page Planning. Modifiez
        autant de lignes que vous voulez, puis enregistrez-les toutes en une
        fois.
      </p>

      <TemplateFilters
        dayOfWeek={dayOfWeekFilter}
        room={roomFilter}
        coachId={coachIdFilter}
        status={statusFilter}
        coaches={coaches}
        rooms={rooms}
      />

      <div className="mb-8 max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-white">
          Ajouter un créneau hebdomadaire
        </h2>
        <form action={createTemplate} className="flex flex-col gap-2">
          <div>
            <span className="mb-1 block text-xs text-neutral-500">
              Jour(s) de la semaine
            </span>
            <div className="flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <label
                  key={d}
                  className="flex items-center gap-1.5 text-sm text-neutral-300"
                >
                  <input
                    type="checkbox"
                    name="dayOfWeek"
                    value={d}
                    className="accent-white"
                  />
                  {dayName(d).slice(0, 3)}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1 block text-xs text-neutral-500">Salle(s)</span>
            <div className="flex flex-wrap gap-3">
              {rooms.map((room) => (
                <label
                  key={room.id}
                  className="flex items-center gap-1.5 text-sm text-neutral-300"
                >
                  <input
                    type="checkbox"
                    name="roomId"
                    value={room.id}
                    className="accent-white"
                  />
                  {room.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="time"
              name="startTime"
              required
              className="w-1/2 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
            />
            <input
              type="time"
              name="endTime"
              required
              className="w-1/2 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
            />
          </div>
          <input
            type="text"
            name="label"
            required
            placeholder="Intitulé (ex. WOD de 6h)"
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
          <label className="flex items-center gap-1.5 text-sm text-neutral-300">
            <input type="checkbox" name="isPrivate" className="accent-white" />
            Cours privé
          </label>
          <div>
            <span className="mb-1 block text-xs text-neutral-500">
              Coach par défaut (optionnel)
            </span>
            <select
              name="coachId"
              defaultValue=""
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
            >
              <option value="">Aucun coach par défaut</option>
              {coaches.map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {coach.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="mt-1 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Ajouter le créneau
          </button>
        </form>
      </div>

      <form id={BULK_FORM_ID} action={updateTemplates} />

      <div className="mb-3 flex justify-end">
        <button
          type="submit"
          form={BULK_FORM_ID}
          className="rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Enregistrer les modifications
        </button>
      </div>

      <TemplateBulkAssignProvider coaches={coaches}>
        <div className="mb-8 overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-left text-neutral-400">
              <tr>
                <th className="w-8 px-4 py-2">
                  <SelectAllTemplatesCheckbox ids={templates.map((tpl) => tpl.id)} />
                </th>
                <th className="px-4 py-2 font-medium">Jour</th>
                <th className="px-4 py-2 font-medium">Heure</th>
                <th className="px-4 py-2 font-medium">Salle</th>
                <th className="px-4 py-2 font-medium">Intitulé</th>
                <th className="px-4 py-2 font-medium">Privé</th>
                <th className="px-4 py-2 font-medium">Coach</th>
                <th className="px-4 py-2 font-medium">Statut</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {templates.map((tpl) => {
                // Keying on the editable fields (not just tpl.id) forces this
                // row to remount after a successful save — otherwise the
                // uncontrolled select/input elements keep showing whatever
                // was last typed/selected instead of the saved value.
                const rowKey = [
                  tpl.id,
                  tpl.dayOfWeek,
                  tpl.startTime,
                  tpl.endTime,
                  tpl.roomId,
                  tpl.label,
                  tpl.coachId ?? "",
                ].join(":");
                return (
                  <tr key={rowKey} className="border-t border-neutral-800">
                    <td className="px-4 py-2">
                      <SelectTemplateCheckbox id={tpl.id} />
                    </td>
                    <td className="px-1 py-1">
                      <input type="hidden" name="ids" value={tpl.id} form={BULK_FORM_ID} />
                      <select
                        name={`dayOfWeek:${tpl.id}`}
                        form={BULK_FORM_ID}
                        defaultValue={tpl.dayOfWeek}
                        className={FIELD_CLASS}
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                          <option key={d} value={d}>
                            {dayName(d)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <div className="flex items-center gap-1">
                        <input
                          type="time"
                          name={`startTime:${tpl.id}`}
                          form={BULK_FORM_ID}
                          defaultValue={tpl.startTime}
                          className={FIELD_CLASS}
                        />
                        <input
                          type="time"
                          name={`endTime:${tpl.id}`}
                          form={BULK_FORM_ID}
                          defaultValue={tpl.endTime}
                          className={FIELD_CLASS}
                        />
                      </div>
                    </td>
                    <td className="px-1 py-1">
                      <select
                        name={`roomId:${tpl.id}`}
                        form={BULK_FORM_ID}
                        defaultValue={tpl.roomId}
                        className={FIELD_CLASS}
                      >
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="text"
                        name={`label:${tpl.id}`}
                        form={BULK_FORM_ID}
                        defaultValue={tpl.label}
                        className={FIELD_CLASS}
                      />
                    </td>
                    <td className="px-4 py-2 text-neutral-400">
                      {tpl.isPrivate ? "Oui" : "—"}
                    </td>
                    <td className="px-1 py-1">
                      <select
                        name={`coachId:${tpl.id}`}
                        form={BULK_FORM_ID}
                        defaultValue={tpl.coachId ?? ""}
                        className={FIELD_CLASS}
                      >
                        <option value="">Non assigné</option>
                        {coaches.map((coach) => (
                          <option key={coach.id} value={coach.id}>
                            {coach.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <form action={toggleTemplateActive}>
                        <input type="hidden" name="id" value={tpl.id} />
                        <input
                          type="hidden"
                          name="active"
                          value={String(tpl.active)}
                        />
                        <button
                          type="submit"
                          role="switch"
                          aria-checked={tpl.active}
                          title={tpl.active ? "Actif — cliquer pour désactiver" : "Inactif — cliquer pour activer"}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                            tpl.active ? "bg-emerald-600" : "bg-neutral-700"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              tpl.active ? "translate-x-[18px]" : "translate-x-[2px]"
                            }`}
                          />
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <form action={deleteTemplate} className="inline">
                        <input type="hidden" name="id" value={tpl.id} />
                        <button
                          type="submit"
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Supprimer
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {templates.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-6 text-center text-neutral-500"
                  >
                    Aucun modèle de cours pour l&apos;instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </TemplateBulkAssignProvider>
    </div>
  );
}
