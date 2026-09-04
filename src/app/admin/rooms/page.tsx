import { tenantPrisma } from "@/lib/prisma";
import { requireOrgAdmin } from "@/lib/auth-context";
import { createRoom, renameRoom, archiveRoom, unarchiveRoom } from "@/lib/actions/rooms";

// Same reasoning as /admin/coaches: without this, Next would statically
// prerender the page and freeze the room list until the next deploy.
export const dynamic = "force-dynamic";

type RoomRow = {
  id: string;
  name: string;
  shortLabel: string | null;
  color: string | null;
  archived: boolean;
};

function RoomCard({ room }: { room: RoomRow }) {
  return (
    <div
      className={`flex flex-col rounded-lg border p-4 ${
        room.archived
          ? "border-neutral-800 bg-neutral-900/50 opacity-70"
          : "border-neutral-800 bg-neutral-900"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-base font-semibold text-white">
          {room.color && (
            <span
              style={{ backgroundColor: room.color }}
              className="h-2.5 w-2.5 shrink-0 rounded-full"
            />
          )}
          {room.name}
          {room.archived && (
            <span className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-neutral-500">
              Archivée
            </span>
          )}
        </div>
        {room.archived ? (
          <form action={unarchiveRoom}>
            <input type="hidden" name="id" value={room.id} />
            <button
              type="submit"
              className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white"
            >
              Désarchiver
            </button>
          </form>
        ) : (
          <form action={archiveRoom}>
            <input type="hidden" name="id" value={room.id} />
            <button
              type="submit"
              className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white"
            >
              Archiver
            </button>
          </form>
        )}
      </div>

      {!room.archived && (
        <form action={renameRoom} className="border-t border-neutral-800 pt-3">
          <input type="hidden" name="id" value={room.id} />
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-500">Nom</span>
              <input
                type="text"
                name="name"
                defaultValue={room.name}
                className="w-full rounded border border-neutral-800 bg-transparent px-1.5 py-1 text-xs text-white hover:border-neutral-700 focus:border-neutral-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-500">Abréviation</span>
              <input
                type="text"
                name="shortLabel"
                defaultValue={room.shortLabel ?? ""}
                placeholder={room.name.slice(0, 2)}
                maxLength={4}
                className="w-full rounded border border-neutral-800 bg-transparent px-1.5 py-1 text-xs text-white hover:border-neutral-700 focus:border-neutral-500 focus:outline-none"
              />
            </label>
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs text-neutral-500">Couleur</span>
              <input
                type="color"
                name="color"
                defaultValue={room.color ?? "#525252"}
                className="h-8 w-full rounded border border-neutral-800 bg-transparent px-1 py-1"
              />
            </label>
          </div>
          <button
            type="submit"
            className="mt-3 w-full rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Enregistrer
          </button>
        </form>
      )}
    </div>
  );
}

export default async function RoomsPage() {
  const { organizationId } = await requireOrgAdmin();
  const rooms = await tenantPrisma(organizationId).room.findMany({
    orderBy: [{ archived: "asc" }, { createdAt: "asc" }],
  });

  const activeRooms = rooms.filter((r) => !r.archived);
  const archivedRooms = rooms.filter((r) => r.archived);

  return (
    <div className="text-neutral-300">
      <h1 className="mb-4 text-lg font-semibold text-white">Salles</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Les salles définies ici apparaissent sur le Planning et les Modèles de cours. Une salle
        utilisée par des cours passés ne peut pas être supprimée — archive-la à la place.
      </p>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeRooms.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>

      {archivedRooms.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-neutral-500">
            Archivées ({archivedRooms.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {archivedRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </div>
      )}

      <div className="max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-white">Ajouter une salle</h2>
        <form action={createRoom} className="flex flex-col gap-2">
          <input
            type="text"
            name="name"
            required
            placeholder="Nom de la salle"
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
          <input
            type="text"
            name="shortLabel"
            maxLength={4}
            placeholder="Abréviation (ex. S1)"
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
          <label className="flex items-center gap-2 text-xs text-neutral-500">
            Couleur
            <input type="color" name="color" defaultValue="#525252" className="h-8 flex-1" />
          </label>
          <button
            type="submit"
            className="mt-1 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Ajouter la salle
          </button>
        </form>
      </div>
    </div>
  );
}
