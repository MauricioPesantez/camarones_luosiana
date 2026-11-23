-- El admin muestra las ordenes del dia a quien entrego el conteo.
ALTER TABLE "SesionCaja"
ADD COLUMN "ordenesHabilitadasAt" TIMESTAMP(3),
ADD COLUMN "ordenesHabilitadasPorNombre" TEXT;
