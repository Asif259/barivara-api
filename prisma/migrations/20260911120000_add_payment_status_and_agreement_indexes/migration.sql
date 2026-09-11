-- CreateIndex
CREATE INDEX "rental_agreements_unitId_status_idx" ON "rental_agreements"("unitId", "status");

-- CreateIndex
CREATE INDEX "payments_monthlyRentId_status_idx" ON "payments"("monthlyRentId", "status");
