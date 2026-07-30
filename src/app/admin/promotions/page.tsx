import { requireRole } from '@/features/auth/queries';
import { listPromotions } from '@/features/promotions/queries';
import { deletePromotion, setPromotionActive } from '@/features/promotions/actions';
import { PromotionForm } from '@/features/promotions/components/promotion-form';
import { PromoBanner } from '@/features/promotions/components/promo-banner';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Promotions' };

/**
 * Manage the homepage banner.
 *
 * Only one can be live at a time — activating one deactivates the others. A
 * homepage that stacks competing sales looks like a discount site rather than a
 * price-comparison one, and dilutes whichever offer actually matters.
 */
export default async function AdminPromotionsPage() {
  await requireRole('admin', '/admin/promotions');
  const promotions = await listPromotions();

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-1 font-display text-base font-bold tracking-tight">
          New banner
        </h2>
        <p className="mb-4 max-w-2xl text-sm text-ink-muted">
          Saved inactive so you can preview it below before it goes live.
        </p>
        <div className="max-w-2xl rounded-card border border-hairline bg-surface p-6">
          <PromotionForm />
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-base font-bold tracking-tight">
          Existing banners
        </h2>

        {promotions.length === 0 ? (
          <p className="rounded-card border border-hairline bg-surface p-6 text-sm text-ink-muted">
            None yet. The home page shows the search bar alone until one is live.
          </p>
        ) : (
          <ul className="space-y-6">
            {promotions.map((promotion) => (
              <li key={promotion.id} className="space-y-3">
                <PromoBanner promotion={promotion} />

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span
                    className={`rounded-full px-2.5 py-1 font-mono text-[11px] tracking-[0.12em] uppercase ${
                      promotion.active
                        ? 'bg-positive-wash text-positive'
                        : 'bg-paper text-ink-faint'
                    }`}
                  >
                    {promotion.active ? 'Live' : 'Inactive'}
                  </span>

                  {promotion.endsAt ? (
                    <span className="text-xs text-ink-faint">
                      Ends {new Date(promotion.endsAt).toLocaleString('en-GB')}
                    </span>
                  ) : (
                    <span className="text-xs text-caution">No end date set</span>
                  )}

                  <form
                    action={async () => {
                      'use server';
                      await setPromotionActive(promotion.id, !promotion.active);
                    }}
                  >
                    <Button type="submit" variant="secondary">
                      {promotion.active ? 'Take down' : 'Make live'}
                    </Button>
                  </form>

                  <form
                    action={async () => {
                      'use server';
                      await deletePromotion(promotion.id);
                    }}
                  >
                    <Button type="submit" variant="ghost">
                      Delete
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
